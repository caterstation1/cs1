import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyDriverToken } from '@/lib/dd-auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token') || ''
    const auth = verifyDriverToken(token)
    if (!auth.valid || !auth.driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const driverId = auth.driverId

    const offers = await prisma.jobOffer.findMany({
      where: { driverId, status: { in: ['offered', 'accepted'] } },
      orderBy: { offeredAt: 'desc' },
    })

    return NextResponse.json(offers)
  } catch (e) {
    console.error('dd/offers error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

