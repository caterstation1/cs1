import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyDriverToken } from '@/lib/dd-auth'

export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || ''
    const auth = verifyDriverToken(token)
    if (!auth.valid || !auth.driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const deliveredNote = body?.deliveredNote || null
    const deliveredProofUrl = body?.deliveredProofUrl || null

    // Ensure driver is assigned to this job
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId }, select: { assignedDriverId: true } })
    if (!job || job.assignedDriverId !== auth.driverId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.deliveryJob.update({
      where: { id: jobId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveredNote,
        deliveredProofUrl,
      },
    })
    await prisma.jobEvent.create({ data: { jobId, eventType: 'deliver', actor: 'driver', data: { deliveredNote, deliveredProofUrl } } })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('dd/jobs delivered error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

