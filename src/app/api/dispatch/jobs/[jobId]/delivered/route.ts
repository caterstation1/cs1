import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params
    const { note, proofUrl } = await req.json()
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const updated = await prisma.deliveryJob.update({
      where: { id: jobId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveredNote: note || null,
        deliveredProofUrl: proofUrl || null,
      },
    })
    await prisma.jobEvent.create({
      data: { jobId, eventType: 'deliver', actor: 'driver', data: { note: note || null, proof: !!proofUrl } },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('deliver error', e)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

