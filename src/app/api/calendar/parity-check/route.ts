import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { addDaysNZ } from '@/lib/date-utils'
import { getDayWindowForYmd, getRangeWindowForYmd, parseCalendarRegion } from '@/lib/calendar-query'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = parseCalendarRegion(searchParams.get('region'))
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!region || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, start, end' },
        { status: 400 }
      )
    }

    let rangeStart: Date
    let rangeEndExclusive: Date
    try {
      const range = getRangeWindowForYmd({ startYmd: start, endYmdExclusive: end })
      rangeStart = range.start
      rangeEndExclusive = range.endExclusive
    } catch {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const grouped = await withRetry(async () => {
      return await prisma.$queryRaw<Array<{ date: Date; total_count: number }>>`
        SELECT 
          DATE("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland') as date,
          COUNT(*)::int as total_count
        FROM "Order"
        WHERE 
          "region" = ${region}
          AND "deliveryDateTime" >= ${rangeStart}
          AND "deliveryDateTime" < ${rangeEndExclusive}
          AND "deliveryDateTime" IS NOT NULL
        GROUP BY DATE("deliveryDateTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Auckland')
        ORDER BY date ASC
      `
    })

    const groupedMap = new Map<string, number>(
      grouped.map((row) => [new Date(row.date).toISOString().split('T')[0], Number(row.total_count || 0)])
    )

    const byDay: Array<{ date: string; count: number }> = []
    for (let ymd = start; ymd < end; ymd = addDaysNZ(ymd, 1)) {
      const { start: dayStart, endExclusive } = getDayWindowForYmd(ymd)
      const count = await withRetry(async () => {
        return await prisma.order.count({
          where: {
            region,
            deliveryDateTime: {
              gte: dayStart,
              lt: endExclusive,
            },
          },
        })
      })
      byDay.push({ date: ymd, count })
    }

    const mismatches = byDay
      .map((row) => {
        const groupedCount = groupedMap.get(row.date) || 0
        if (groupedCount === row.count) return null
        return {
          date: row.date,
          groupedCount,
          byDayCount: row.count,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      region,
      start,
      end,
      totalDaysChecked: byDay.length,
      mismatchCount: mismatches.length,
      mismatches,
    })
  } catch (error) {
    console.error('Calendar parity check failed:', error)
    return NextResponse.json({ error: 'Failed to run parity check' }, { status: 500 })
  }
}

