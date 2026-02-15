import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // Verification for WhatsApp webhook
  const params = new URL(req.url).searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token') || ''
  const challenge = params.get('hub.challenge') || ''
  const expected = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim()
  const bypass = (process.env.WA_VERIFY_BYPASS || '').toLowerCase() === 'true'
  try {
    console.log('[WA VERIFY] mode=%s tokenLen=%d challengeLen=%d expectedSet=%s bypass=%s',
      mode, token.trim().length, challenge.length, expected.length > 0, bypass)
  } catch {}
  if (mode === 'subscribe' && challenge && (token.trim() === expected || bypass)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new NextResponse('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entries = Array.isArray(body.entry) ? body.entry : []
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : []
      for (const change of changes) {
        const value = change.value
        const messages = value?.messages
        const interactive = Array.isArray(messages) ? messages.find((m: any) => m.type === 'interactive') : null
        if (!interactive) continue
        const fromPhone = interactive.from
        const buttonReply = interactive.interactive?.button_reply
        if (!buttonReply) continue
        const payloadId = buttonReply.id as string // expect format: offer:<jobOfferId>:accept|decline
        const parts = (payloadId || '').split(':')
        if (parts.length < 3 || parts[0] !== 'offer') continue
        const jobOfferId = parts[1]
        const action = parts[2] // accept|decline

        // Find the DataDriver by phone
        const driver = await prisma.dataDriver.findFirst({ where: { phone: fromPhone } })
        if (!driver) continue

        // Find offer
        const offer = await prisma.jobOffer.findUnique({ where: { id: jobOfferId } })
        if (!offer || offer.driverId !== driver.id) continue

        if (action === 'accept') {
          // First-write-wins: transaction to assign if still offered
          await prisma.$transaction(async (tx) => {
            const freshOffer = await tx.jobOffer.findUnique({ where: { id: jobOfferId } })
            if (!freshOffer || freshOffer.status !== 'offered') return
            const job = await tx.deliveryJob.findUnique({ where: { id: freshOffer.jobId } })
            if (!job || job.status !== 'offered') return
            await tx.deliveryJob.update({
              where: { id: job.id },
              data: { status: 'assigned', assignedDriverId: driver.id },
            })
            await tx.jobOffer.update({ where: { id: freshOffer.id }, data: { status: 'accepted', respondedAt: new Date() } })
            await tx.jobEvent.create({ data: { jobId: job.id, eventType: 'assign', actor: 'driver', data: { driverId: driver.id } } })
            // Expire other offers
            await tx.jobOffer.updateMany({
              where: { jobId: job.id, id: { not: freshOffer.id }, status: 'offered' },
              data: { status: 'expired', respondedAt: new Date() },
            })
          })
        } else if (action === 'decline') {
          await prisma.jobOffer.update({
            where: { id: jobOfferId },
            data: { status: 'declined', respondedAt: new Date() },
          })
          await prisma.jobEvent.create({
            data: { jobId: offer.jobId, eventType: 'decline', actor: 'driver', data: { driverId: driver.id } },
          })
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('WA webhook error', e)
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
}

