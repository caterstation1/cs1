import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { addDaysNZ, getNZDateRangeForYmd } from '@/lib/date-utils'

export async function POST(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const weekStart = body.weekStart as string
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'weekStart (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const weekEnd = addDaysNZ(weekStart, 6)
    const { start } = getNZDateRangeForYmd(weekStart)
    const { end } = getNZDateRangeForYmd(weekEnd)

    const result = await prisma.shift.updateMany({
      where: {
        date: { gte: start, lte: end },
        approved: false,
        clockOut: { not: null },
      },
      data: {
        approved: true,
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({
      approvedCount: result.count,
      weekStart,
      weekEnd,
    })
  } catch (e) {
    console.error('approve-week error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
