// Resend Inbound webhook — supplier price emails forwarded by mail rule.
//
// Resend signs webhooks svix-style; verification is done by hand here (HMAC
// SHA-256 over `${id}.${timestamp}.${rawBody}`) so we do not need the svix
// package. The webhook carries metadata only; the processing pipeline fetches
// body and attachments from the Resend API afterwards.
//
// This path is listed in middleware PUBLIC_PREFIXES — authentication is the
// signature, not a session.

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { processInboundEmail } from '@/lib/pricing/ingest'

export const maxDuration = 300

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().min(1),
    from: z.string().default(''),
    subject: z.string().nullable().default(''),
  }),
})

function verifySvixSignature(rawBody: string, headers: Headers): { ok: boolean; error?: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return { ok: false, error: 'RESEND_WEBHOOK_SECRET is not set' }

  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatureHeader = headers.get('svix-signature')
  if (!id || !timestamp || !signatureHeader) return { ok: false, error: 'Missing svix headers' }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, error: 'Stale webhook timestamp' }
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${rawBody}`).digest()

  // Header format: space-separated "v1,<base64sig>" entries.
  for (const part of signatureHeader.split(' ')) {
    const [, sig] = part.split(',')
    if (!sig) continue
    const candidate = Buffer.from(sig, 'base64')
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return { ok: true }
    }
  }
  return { ok: false, error: 'Signature mismatch' }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const verification = verifySvixSignature(rawBody, request.headers)
  if (!verification.ok) {
    console.warn(`⚠️ [price-email] Rejected webhook: ${verification.error}`)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: z.infer<typeof eventSchema>
  try {
    event = eventSchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ ignored: event.type })
  }

  const emailId = event.data.email_id

  // Webhooks retry — do not reprocess an email we have already ingested.
  const existing = await prisma.emailIngestion.findFirst({
    where: { report: { path: ['resendEmailId'], equals: emailId } },
    select: { id: true, status: true },
  })
  if (existing) {
    return NextResponse.json({ deduped: true, ingestionId: existing.id, status: existing.status })
  }

  const ingestion = await prisma.emailIngestion.create({
    data: {
      fromAddress: event.data.from,
      subject: event.data.subject ?? '',
      status: 'received',
      report: { resendEmailId: emailId },
    },
  })

  const result = await processInboundEmail(emailId, ingestion.id)

  return NextResponse.json({
    ingestionId: ingestion.id,
    status: result.status,
    supplier: result.supplier,
    parser: result.parser,
  })
}
