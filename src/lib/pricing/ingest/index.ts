// Orchestrates one inbound price email, end to end:
// fetch content from Resend → identify supplier → extract rows (deterministic
// parsers first, LLM last) → apply to catalogue → recalc → summary email.
//
// Every failure path lands in the EmailIngestion row as a readable report;
// a bad email can never leave half-applied state without saying so.

import { Prisma } from '@/generated/prisma'
import { buildTransporter } from '../../day-prior-notification-service'
import { prisma } from '../../prisma'
import { applyRows, ApplyReport } from './apply'
import { identifySupplier, SUPPLIER_LABEL } from './identify'
import { llmExtractRows } from './llm'
import {
  parseBidfoodInvoiceText,
  parseCsvForSupplier,
  parseGilmoursOrderText,
  parseHtmlTables,
  ParseOutcome,
  parseProduceCoOrderText,
  SupplierId,
} from './parse'
import {
  downloadAttachment,
  getReceivedEmail,
  listReceivedAttachments,
  MAX_ATTACHMENT_BYTES,
} from './resend-inbound'

export interface ProcessResult {
  status: 'applied' | 'needs_review' | 'failed'
  supplier: SupplierId | null
  parser: string | null
  report: Record<string, unknown>
}

/** Enough of the body to rebuild a parser from, small enough to sit in a Json column. */
const MAX_BODY_SAMPLE_CHARS = 8000

const isCsvAttachment = (filename: string, contentType: string): boolean =>
  /\.csv$/i.test(filename) || /text\/csv/i.test(contentType)

const isSpreadsheet = (filename: string, contentType: string): boolean =>
  /\.(xlsx?|ods)$/i.test(filename) || /spreadsheet|ms-excel/i.test(contentType)

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Processes one received email and updates its EmailIngestion row in place.
 * Never throws — failures become status 'failed' with the error in the report.
 */
export async function processInboundEmail(resendEmailId: string, ingestionId: string): Promise<ProcessResult> {
  const notes: string[] = []
  let supplier: SupplierId | null = null
  let outcome: ParseOutcome | null = null

  try {
    const email = await getReceivedEmail(resendEmailId)
    supplier = identifySupplier({ from: email.from, subject: email.subject, text: email.text, html: email.html })

    await prisma.emailIngestion.update({
      where: { id: ingestionId },
      data: { supplier: supplier ? SUPPLIER_LABEL[supplier] : null },
    })

    if (!supplier) {
      const report = { resendEmailId, notes: ['Could not identify supplier from sender, subject, or body.'] }
      await prisma.emailIngestion.update({
        where: { id: ingestionId },
        data: { status: 'needs_review', report },
      })
      return { status: 'needs_review', supplier: null, parser: null, report }
    }

    // 1. CSV attachments — the only path allowed to create catalogue rows.
    const attachments = await listReceivedAttachments(resendEmailId)
    for (const attachment of attachments) {
      if (outcome) break
      if (isCsvAttachment(attachment.filename, attachment.contentType)) {
        if (attachment.size > MAX_ATTACHMENT_BYTES) {
          notes.push(`Skipped oversized attachment ${attachment.filename}`)
          continue
        }
        const buffer = await downloadAttachment(attachment)
        outcome = parseCsvForSupplier(supplier, buffer.toString('utf-8'))
        if (!outcome) notes.push(`Attachment ${attachment.filename} did not parse as a price CSV`)
      } else if (isSpreadsheet(attachment.filename, attachment.contentType)) {
        notes.push(`Attachment ${attachment.filename} is a spreadsheet — export it as CSV and forward again, or upload it manually.`)
      }
    }

    // 2. Order-confirmation bodies in each supplier's own layout.
    if (!outcome && supplier === 'gilmours') {
      const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : '')
      outcome = parseGilmoursOrderText(bodyText)
    }
    if (!outcome && supplier === 'bidfood') {
      const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : '')
      outcome = parseBidfoodInvoiceText(bodyText)
    }
    if (!outcome && supplier === 'produceco') {
      const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : '')
      outcome = parseProduceCoOrderText(bodyText)
    }

    // 3. HTML tables in the body — order confirmations that kept their table.
    if (!outcome && email.html) {
      outcome = parseHtmlTables(email.html)
    }

    // Every deterministic parser has now declined. Keep a sample of what they
    // were looking at: without it, fixing the parser means waiting for the next
    // email and hoping to catch it. Stored before the LLM runs, so it survives
    // the LLM throwing (a dead API key used to lose the evidence entirely).
    let bodySample: string | null = null
    if (!outcome) {
      const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : '')
      bodySample = bodyText.slice(0, MAX_BODY_SAMPLE_CHARS)
      notes.push('No deterministic parser matched this layout; body sample captured for review.')
      await prisma.emailIngestion
        .update({
          where: { id: ingestionId },
          data: { report: { resendEmailId, notes, bodySample } },
        })
        .catch(() => {})
    }

    // 4. LLM extraction as the last resort.
    if (!outcome) {
      const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : '')
      outcome = await llmExtractRows(bodyText).catch((err) => {
        // A dead or out-of-credit LLM must not discard a readable email; the
        // body sample above is what makes the layout fixable.
        notes.push(`LLM extraction unavailable: ${err instanceof Error ? err.message : 'unknown error'}`)
        return null
      })
      if (!outcome) notes.push('No parser produced rows (CSV, HTML table, and LLM extraction all came up empty).')
    }

    if (!outcome) {
      const report = { resendEmailId, notes, ...(bodySample ? { bodySample } : {}) }
      await prisma.emailIngestion.update({
        where: { id: ingestionId },
        data: { status: 'needs_review', report },
      })
      await sendProblemEmail(supplier, email.subject, 'needs_review', notes).catch((err) => {
        console.error('⚠️ [price-email] Problem email failed:', err)
      })
      return { status: 'needs_review', supplier, parser: null, report }
    }

    const applied = await applyRows(supplier, outcome.rows, {
      ingestionId,
      allowCreate: outcome.structured && !outcome.fullRange,
      fullRange: outcome.fullRange,
      promoteUnmatched: !outcome.fullRange,
    })

    // Kept even on success: a parser that read 10 of 14 items looks like a clean
    // run in every counter, and the body is the only way to see the other four.
    const report: Record<string, unknown> = {
      resendEmailId,
      notes,
      bodySample:
        bodySample ??
        (email.text?.trim() || (email.html ? stripHtml(email.html) : '')).slice(0, MAX_BODY_SAMPLE_CHARS),
      ...applied,
    }
    const status =
      applied.rowsMatched === 0 && applied.created === 0 ? 'needs_review' : 'applied'

    await prisma.emailIngestion.update({
      where: { id: ingestionId },
      data: {
        status,
        parser: outcome.parser,
        rowsParsed: applied.rowsParsed,
        rowsMatched: applied.rowsMatched,
        rowsUnmatched: applied.rowsUnmatched,
        report: report as Prisma.InputJsonValue,
      },
    })

    if (status === 'applied') {
      await sendSummaryEmail(supplier, outcome.parser, applied).catch((err) => {
        console.error('⚠️ [price-email] Summary email failed:', err)
      })
    } else {
      await sendProblemEmail(supplier, email.subject, status, notes).catch((err) => {
        console.error('⚠️ [price-email] Problem email failed:', err)
      })
    }

    return { status, supplier, parser: outcome.parser, report }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [price-email] Ingestion failed:', error)
    const report = { resendEmailId, notes, error: message }
    await prisma.emailIngestion
      .update({ where: { id: ingestionId }, data: { status: 'failed', report } })
      .catch(() => {})
    // Silence was the real fault here: eleven Gilmours and Produce Co emails
    // died on an out-of-credit LLM without anyone being told.
    await sendProblemEmail(supplier, null, 'failed', notes, message).catch((err) => {
      console.error('⚠️ [price-email] Problem email failed:', err)
    })
    return { status: 'failed', supplier, parser: outcome?.parser ?? null, report }
  }
}

const money = (v: number) => `$${v.toFixed(2)}`
const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function digestRecipient(): Promise<string | null> {
  const settingsRow = await prisma.pricingSettings.findFirst()
  return settingsRow?.digestEmail || process.env.PRICING_DIGEST_EMAIL || process.env.DAY_PRIOR_EMAIL_USER || null
}

/**
 * Tells someone when an email did not land. Previously only successes were
 * reported, so a supplier whose layout no parser understood simply went quiet.
 */
async function sendProblemEmail(
  supplier: SupplierId | null,
  subject: string | null,
  status: 'needs_review' | 'failed',
  notes: string[],
  error?: string
): Promise<void> {
  const recipient = await digestRecipient()
  if (!recipient) return

  const label = supplier ? SUPPLIER_LABEL[supplier] : 'Unknown supplier'
  const headline = status === 'failed' ? 'could not be processed' : 'needs review'

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;color:#111">
      <h2 style="margin-bottom:4px">${label} price email ${headline}</h2>
      ${subject ? `<p style="color:#666;margin-top:0">${escapeHtml(subject)}</p>` : ''}
      ${error ? `<p style="color:#c0392b"><strong>${escapeHtml(error)}</strong></p>` : ''}
      ${notes.length ? `<ul style="margin:0;padding-left:20px">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
      <p style="margin-top:16px">No prices were changed. The email is kept, so it can be reprocessed once the cause is fixed.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">Automated by /api/inbound/price-email.</p>
    </div>`

  const transporter = buildTransporter()
  await transporter.sendMail({
    from: process.env.DAY_PRIOR_EMAIL_USER || process.env.EMAIL_USER,
    to: recipient,
    subject: `${label} price email ${headline}${subject ? ` — ${subject}` : ''}`,
    html,
  })
}

async function sendSummaryEmail(supplier: SupplierId, parser: string, report: ApplyReport): Promise<void> {
  const recipient = await digestRecipient()
  if (!recipient) return

  const bigMoves = report.priceChanges.filter((c) => Math.abs(c.pctChange) > 0.05)
  const label = SUPPLIER_LABEL[supplier]

  const changeRows = report.priceChanges
    .slice(0, 30)
    .map(
      (c) =>
        `<tr><td style="padding:2px 10px 2px 0">${escapeHtml(c.description || c.code)}</td>` +
        `<td style="padding:2px 10px 2px 0">${money(c.oldPrice)} → <strong>${money(c.newPrice)}</strong></td>` +
        `<td style="padding:2px 0;color:${c.pctChange > 0 ? '#c0392b' : '#27ae60'}">${(c.pctChange * 100).toFixed(1)}%</td></tr>`
    )
    .join('')

  const unmatchedRows = report.unmatched
    .slice(0, 15)
    .map((u) => `<li>${escapeHtml([u.sku, u.description].filter(Boolean).join(' — '))} (${money(u.price)})</li>`)
    .join('')

  // Pack reading is the one thing nobody can verify from the invoice alone, and
  // every per-kg figure downstream depends on it — so it is shown, not summarised.
  const promotedRows = report.promoted
    .slice(0, 20)
    .map(
      (p) =>
        `<tr><td style="padding:2px 10px 2px 0">${escapeHtml(p.sku)}</td>` +
        `<td style="padding:2px 10px 2px 0">${escapeHtml(p.name)}${p.namePlaceholder ? ' <em style="color:#c0392b">(needs a name)</em>' : ''}</td>` +
        `<td style="padding:2px 10px 2px 0">${escapeHtml(p.packReading)}</td>` +
        `<td style="padding:2px 10px 2px 0">${p.unitCost == null ? '<em style="color:#c0392b">no unit cost</em>' : `${money(p.unitCost)}/${escapeHtml(p.canonicalUnit)}`}</td>` +
        `<td style="padding:2px 0;color:${p.packConfidence < 0.6 ? '#c0392b' : '#666'}">${p.packConfidence.toFixed(2)}</td></tr>`
    )
    .join('')

  const repairedRows = report.repaired
    .slice(0, 20)
    .map(
      (r) =>
        `<tr><td style="padding:2px 10px 2px 0">${escapeHtml(r.sku)}</td>` +
        `<td style="padding:2px 10px 2px 0;color:#666"><s>${escapeHtml(r.previousName)}</s></td>` +
        `<td style="padding:2px 10px 2px 0">${escapeHtml(r.name)}</td>` +
        `<td style="padding:2px 10px 2px 0">${escapeHtml(r.packReading)}</td>` +
        `<td style="padding:2px 0;color:${r.packConfidence < 0.6 ? '#c0392b' : '#666'}">${r.packConfidence.toFixed(2)}</td></tr>`
    )
    .join('')

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;color:#111">
      <h2 style="margin-bottom:4px">${label} price email applied</h2>
      <p style="color:#666;margin-top:0">Parser: ${escapeHtml(parser)}</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:3px 14px 3px 0;color:#666">Rows parsed</td><td><strong>${report.rowsParsed}</strong></td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#666">Matched</td><td><strong>${report.rowsMatched}</strong></td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#666">New catalogue rows</td><td><strong>${report.created}</strong></td></tr>
        ${report.promoted.length ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Added to ingredient list</td><td><strong>${report.promoted.length}</strong></td></tr>` : ''}
        ${report.repaired.length ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Renamed from a product code</td><td><strong>${report.repaired.length}</strong></td></tr>` : ''}
        <tr><td style="padding:3px 14px 3px 0;color:#666">Unmatched</td><td><strong>${report.rowsUnmatched}</strong></td></tr>
        ${report.rowsSkippedNotInCatalogue ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Not in catalogue (ignored)</td><td><strong>${report.rowsSkippedNotInCatalogue}</strong></td></tr>` : ''}
        ${report.uomMismatches.length ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Skipped (unit mismatch)</td><td><strong>${report.uomMismatches.length}</strong></td></tr>` : ''}
        <tr><td style="padding:3px 14px 3px 0;color:#666">Price changes</td><td><strong>${report.priceChanges.length}</strong> (${bigMoves.length} moved &gt; 5%)</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#666">Price points written</td><td><strong>${report.pricePointsWritten}</strong></td></tr>
        ${report.recalc ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Recalculated</td><td><strong>${report.recalc.componentsUpdated}</strong> components / <strong>${report.recalc.variantsUpdated}</strong> variants</td></tr>` : ''}
        ${report.alerts ? `<tr><td style="padding:3px 14px 3px 0;color:#666">Alerts</td><td><strong>${report.alerts.opened}</strong> opened, <strong>${report.alerts.resolved}</strong> resolved</td></tr>` : ''}
      </table>
      ${changeRows ? `<h3 style="margin:16px 0 6px">Price changes</h3><table style="border-collapse:collapse">${changeRows}</table>` : ''}
      ${
        promotedRows
          ? `<h3 style="margin:16px 0 6px">Added to the ingredient list — please check the pack</h3>` +
            `<table style="border-collapse:collapse;font-size:14px">` +
            `<tr style="color:#666;text-align:left"><th style="padding-right:10px">Code</th><th style="padding-right:10px">Ingredient</th><th style="padding-right:10px">Pack read as</th><th style="padding-right:10px">Unit cost</th><th>Conf</th></tr>` +
            `${promotedRows}</table>` +
            `<p style="color:#666;font-size:13px">These are new to the catalogue. The pack reading is a guess from the invoice, so each is marked unverified until you confirm it.</p>`
          : ''
      }
      ${
        repairedRows
          ? `<h3 style="margin:16px 0 6px">Renamed from a product code</h3>` +
            `<table style="border-collapse:collapse;font-size:14px">` +
            `<tr style="color:#666;text-align:left"><th style="padding-right:10px">Code</th><th style="padding-right:10px">Was</th><th style="padding-right:10px">Now</th><th style="padding-right:10px">Pack read as</th><th>Conf</th></tr>` +
            `${repairedRows}</table>` +
            `<p style="color:#666;font-size:13px">These were added before the parser could read their name and pack. This email supplied both, so the pack is worth a check.</p>`
          : ''
      }
      ${unmatchedRows ? `<h3 style="margin:16px 0 6px">Unmatched rows</h3><ul style="margin:0;padding-left:20px">${unmatchedRows}</ul>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px">Automated by /api/inbound/price-email.</p>
    </div>`

  const transporter = buildTransporter()
  await transporter.sendMail({
    from: process.env.DAY_PRIOR_EMAIL_USER || process.env.EMAIL_USER,
    to: recipient,
    subject:
      `${label} prices applied — ${report.priceChanges.length} change${report.priceChanges.length === 1 ? '' : 's'}` +
      `${report.promoted.length ? `, ${report.promoted.length} new ingredient${report.promoted.length === 1 ? '' : 's'}` : ''}` +
      `, ${report.rowsUnmatched} unmatched`,
    html,
  })
}
