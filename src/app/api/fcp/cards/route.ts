import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getActiveFcpPlan } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'
import type { FcpApiResponse } from '@/types/fcp'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const activePlan = await getActiveFcpPlan()
    if (!activePlan) {
      return NextResponse.json({ error: 'No active FCP plan found' }, { status: 404 })
    }

    const cards = await prisma.fcpCard.findMany({
      where: {
        planId: activePlan.id,
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: [{ severity: 'desc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ colourGroup: 'asc' }, { title: 'asc' }],
    })

    const response: FcpApiResponse<typeof cards> = {
      data: cards,
      meta: {
        activePlanId: activePlan.id,
        activePlanVersion: activePlan.version,
        count: cards.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('fcp cards GET error', error)
    return NextResponse.json({ error: 'Failed to fetch FCP cards' }, { status: 500 })
  }
}
