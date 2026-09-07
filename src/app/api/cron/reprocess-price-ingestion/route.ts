// Re-runs the ingestion pipeline for one EmailIngestion row — for retrying
// after a transient failure (e.g. a bad API key) without re-forwarding the
// email. Under /api/cron so CRON_SECRET auth passes the middleware, matching
// the house pattern for internally-triggered work.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { processInboundEmail } from '@/lib/pricing/ingest'

export const maxDuration = 300

const bodySchema = z.object({ ingestionId: z.string().min(1) })

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'ingestionId required' }, { status: 400 })
  }

  const ingestion = await prisma.emailIngestion.findUnique({ where: { id: body.ingestionId } })
  if (!ingestion) return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 })

  const report = (ingestion.report ?? {}) as Record<string, unknown>
  const resendEmailId = typeof report.resendEmailId === 'string' ? report.resendEmailId : null
  if (!resendEmailId) {
    return NextResponse.json({ error: 'Ingestion has no Resend email id (manual apply?)' }, { status: 400 })
  }

  const result = await processInboundEmail(resendEmailId, ingestion.id)
  return NextResponse.json({ ingestionId: ingestion.id, ...result })
}
