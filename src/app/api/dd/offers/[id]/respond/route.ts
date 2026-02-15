import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyDriverToken } from '@/lib/dd-auth'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || ''
    const auth = verifyDriverToken(token)
    if (!auth.valid || !auth.driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const driverId = auth.driverId
    const body = await req.json()
    const action = (body?.action || '').toLowerCase() // 'accept' | 'decline'

    const offer = await prisma.jobOffer.findUnique({ where: { id } })
    if (!offer || offer.driverId !== driverId) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }
    if (offer.status !== 'offered' && action === 'accept') {
      return NextResponse.json({ status: 'already_processed' })
    }

    if (action === 'decline') {
      await prisma.jobOffer.update({ where: { id }, data: { status: 'declined', respondedAt: new Date() } })
      await prisma.jobEvent.create({ data: { jobId: offer.jobId, eventType: 'decline', actor: 'driver', data: { offerId: id, driverId } } })
      return NextResponse.json({ status: 'declined' })
    }

    if (action === 'accept') {
      // First-write-wins transaction
      const result = await prisma.$transaction(async (tx) => {
        const currentJob = await tx.deliveryJob.findUnique({
          where: { id: offer.jobId },
          select: { status: true, assignedDriverId: true },
        })
        if (currentJob?.status === 'offered' && !currentJob.assignedDriverId) {
          await tx.deliveryJob.update({
            where: { id: offer.jobId },
            data: { status: 'assigned', assignedDriverId: driverId },
          })
          await tx.jobOffer.update({ where: { id }, data: { status: 'accepted', respondedAt: new Date() } })
          await tx.jobOffer.updateMany({
            where: { jobId: offer.jobId, id: { not: id }, status: 'offered' },
            data: { status: 'expired', respondedAt: new Date() },
          })
          await tx.jobEvent.create({ data: { jobId: offer.jobId, eventType: 'accept', actor: 'driver', data: { offerId: id, driverId } } })
          return { status: 'assigned' as const }
        } else {
          await tx.jobOffer.update({ where: { id }, data: { status: 'expired', respondedAt: new Date() } })
          return { status: 'already_assigned' as const }
        }
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e) {
    console.error('dd/offers respond error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

