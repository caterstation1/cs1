// Weekly pricing digest. 18:00 UTC Sunday ≈ 06:00 Monday NZT.
//
// Sent through the same nodemailer/Gmail transport the day-prior notifications
// use, rather than Resend — that is the outbound path this app actually has
// configured.

import { NextRequest, NextResponse } from 'next/server'
import { buildTransporter } from '@/lib/day-prior-notification-service'
import { prisma } from '@/lib/prisma'
import { loadPricingSettings } from '@/lib/pricing/resolve'

export const maxDuration = 300

const money = (v: number) => `$${v.toFixed(2)}`
const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TYPE_LABEL: Record<string, string> = {
  backup_cheaper: 'A cheaper supplier is available',
  price_spike: 'Price spikes',
  special: 'Specials worth using',
  margin_below_target: 'Margin below target',
  missing_cost: 'No knowable cost',
  broken_ref: 'Broken catalogue reference',
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settingsRow = await prisma.pricingSettings.findFirst()
    const settings = await loadPricingSettings()
    const recipient = settingsRow?.digestEmail || process.env.PRICING_DIGEST_EMAIL || null

    if (settingsRow && settingsRow.digestEnabled === false) {
      return NextResponse.json({ success: true, skipped: 'digest disabled in PricingSettings' })
    }
    if (!recipient) {
      return NextResponse.json({
        success: true,
        skipped: 'no recipient — set PricingSettings.digestEmail or PRICING_DIGEST_EMAIL',
      })
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [openAlerts, runs, newPricePoints, unmatchedRows, ingredientCount, linkCount] = await Promise.all([
      prisma.priceAlert.findMany({
        where: { status: 'open' },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
        select: { type: true, message: true, createdAt: true },
      }),
      prisma.recalcRun.findMany({
        where: { startedAt: { gte: weekAgo } },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, trigger: true, componentsUpdated: true, variantsUpdated: true, coveragePct: true },
      }),
      prisma.pricePoint.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.emailIngestion.aggregate({
        where: { receivedAt: { gte: weekAgo } },
        _sum: { rowsUnmatched: true },
      }),
      prisma.ingredient.count({ where: { status: 'active' } }),
      prisma.ingredientSupplierLink.count({ where: { active: true } }),
    ])

    const byType = new Map<string, typeof openAlerts>()
    for (const alert of openAlerts) {
      const bucket = byType.get(alert.type) ?? []
      bucket.push(alert)
      byType.set(alert.type, bucket)
    }

    const latest = runs[0]
    const coverage = latest?.coveragePct == null ? null : `${(latest.coveragePct * 100).toFixed(1)}%`

    // Cheaper-supplier alerts first: they are the ones that save money today.
    const order = ['backup_cheaper', 'special', 'price_spike', 'margin_below_target', 'missing_cost', 'broken_ref']
    const sections = order
      .filter((t) => byType.has(t))
      .map((t) => {
        const alerts = byType.get(t) as typeof openAlerts
        const shown = alerts.slice(0, 15)
        const items = shown.map((a) => `<li>${escapeHtml(a.message)}</li>`).join('')
        const more = alerts.length > shown.length ? `<p style="color:#666">…and ${alerts.length - shown.length} more.</p>` : ''
        return `<h3 style="margin:20px 0 6px">${TYPE_LABEL[t] ?? t} (${alerts.length})</h3><ul style="margin:0;padding-left:20px">${items}</ul>${more}`
      })
      .join('')

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;color:#111">
        <h2 style="margin-bottom:4px">CaterStation pricing digest</h2>
        <p style="color:#666;margin-top:0">Week to ${new Date().toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland' })}</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:3px 14px 3px 0;color:#666">Open alerts</td><td><strong>${openAlerts.length}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">Recalcs this week</td><td><strong>${runs.length}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">Cost coverage</td><td><strong>${coverage ?? '—'}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">New price points</td><td><strong>${newPricePoints}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">Unmatched email rows</td><td><strong>${unmatchedRows._sum.rowsUnmatched ?? 0}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">Master list</td><td><strong>${ingredientCount}</strong> ingredients / <strong>${linkCount}</strong> supplier links</td></tr>
          <tr><td style="padding:3px 14px 3px 0;color:#666">Target margin</td><td><strong>${(settings.targetMargin * 100).toFixed(0)}%</strong></td></tr>
        </table>
        ${sections || '<p>No open alerts. Nothing needs attention.</p>'}
        <p style="color:#888;font-size:12px;margin-top:28px">Automated by /api/cron/pricing-digest. Thresholds live in PricingSettings.</p>
      </div>`

    const transporter = buildTransporter()
    await transporter.sendMail({
      from: process.env.DAY_PRIOR_EMAIL_USER || process.env.EMAIL_USER,
      to: recipient,
      subject: `Pricing digest — ${openAlerts.length} open alert${openAlerts.length === 1 ? '' : 's'}`,
      html,
    })

    return NextResponse.json({
      success: true,
      recipient,
      openAlerts: openAlerts.length,
      byType: Object.fromEntries([...byType.entries()].map(([t, a]) => [t, a.length])),
      recalcRuns: runs.length,
      newPricePoints,
    })
  } catch (error) {
    console.error('❌ [pricing-digest] Failed:', error)
    return NextResponse.json(
      { error: 'Digest failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
