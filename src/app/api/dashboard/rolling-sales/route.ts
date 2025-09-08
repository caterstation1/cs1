import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'

function addDays(date: Date, delta: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + delta)
  return d
}

function getAucklandDayString(date: Date): string {
  const s = date.toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [day, month, year] = s.split('/').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const totalDays = Math.max(1, Math.min(365, Number(searchParams.get('days') || 365)))
    const windowDays = Math.max(1, Math.min(60, Number(searchParams.get('window') || 28)))

    const todayLocal = getTodayLocal()
    const startForQuery = addDays(todayLocal, -(totalDays + windowDays - 1))

    // Auckland-local start and end boundaries converted to Date objects with +12:00 suffix
    const startIso = `${formatLocalDate(startForQuery)}T00:00:00+12:00`
    const endIso = `${formatLocalDate(todayLocal)}T23:59:59.999+12:00`

    // Pull all orders in the extended range once
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: new Date(startIso),
          lte: new Date(endIso),
        },
      },
      select: { createdAt: true, totalPrice: true },
      orderBy: { createdAt: 'asc' },
    })

    // Aggregate by Auckland-local day
    const dailyMap = new Map<string, number>()
    for (const o of orders) {
      const day = getAucklandDayString(o.createdAt as unknown as Date)
      dailyMap.set(day, (dailyMap.get(day) || 0) + Number(o.totalPrice || 0))
    }

    // Build dense daily array from startForQuery..todayLocal
    const denseDays: string[] = []
    const denseValues: number[] = []
    for (let d = new Date(startForQuery); d <= todayLocal; d = addDays(d, 1)) {
      const key = formatLocalDate(d)
      denseDays.push(key)
      denseValues.push(Number(dailyMap.get(key) || 0))
    }

    // Prefix sums for fast rolling window
    const prefix: number[] = new Array(denseValues.length + 1).fill(0)
    for (let i = 0; i < denseValues.length; i++) prefix[i + 1] = prefix[i] + denseValues[i]

    const series: { date: string; sales28: number }[] = []
    const lastIndex = denseValues.length - 1
    // We produce the last `totalDays` points (ending today)
    for (let i = lastIndex - totalDays + 1; i <= lastIndex; i++) {
      const startIdx = i - (windowDays - 1)
      const clampedStart = Math.max(0, startIdx)
      const sum = prefix[i + 1] - prefix[clampedStart]
      series.push({ date: denseDays[i], sales28: Number(sum.toFixed(2)) })
    }

    return NextResponse.json({ days: totalDays, window: windowDays, series })
  } catch (error) {
    console.error('❌ Error building rolling sales series:', error)
    return NextResponse.json({ error: 'Failed to compute rolling sales series' }, { status: 500 })
  }
}





