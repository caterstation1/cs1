import { NextRequest, NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { evaluateAlerts } from '@/lib/pricing/alerts'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'open'
  const type = searchParams.get('type')
  const refId = searchParams.get('refId')
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 500)

  const alerts = await prisma.priceAlert.findMany({
    where: {
      ...(status === 'all' ? {} : { status }),
      ...(type ? { type } : {}),
      ...(refId ? { refId } : {}),
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  const counts = await prisma.priceAlert.groupBy({
    by: ['type'],
    where: { status: 'open' },
    _count: { _all: true },
  })

  return NextResponse.json({
    alerts,
    openByType: Object.fromEntries(counts.map((c) => [c.type, c._count._all])),
  })
}

/** Re-runs evaluation on demand, for the "refresh alerts" action. */
export async function POST(request: NextRequest) {
  const role = await getAccessLevel()
  if (!role || (role !== 'admin' && role !== 'owner' && role !== 'pricing_lab')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const result = await evaluateAlerts({ includeMissingCosts: body?.includeMissingCosts !== false })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('❌ Alert evaluation failed:', error)
    return NextResponse.json(
      { error: 'Alert evaluation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
