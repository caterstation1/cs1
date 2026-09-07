import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseRangePreset,
  parseLineItems,
  collectVariantCosts,
  sumItemsCost,
  resolveBusinessDate,
  shouldIncludeOrder,
} from '@/lib/accounting'
import { addDaysNZ, formatNZYMD, getNZDateRangeForYmd } from '@/lib/date-utils'

type WindowKey = '7D' | '30D' | '6M' | '12M' | 'ALL'
export const maxDuration = 60

function toBool(v: string | null, def = false): boolean {
  if (v == null) return def
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

function weekdayIndexFromYmd(ymd: string): number {
  const date = getNZDateRangeForYmd(ymd).start
  const short = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    weekday: 'short',
  }).format(date)
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[short] ?? 0
}

function countWeekdaysInRange(start: Date, end: Date): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  let cursor = formatNZYMD(start)
  const endYmd = formatNZYMD(end)
  while (cursor <= endYmd) {
    counts[weekdayIndexFromYmd(cursor)] += 1
    cursor = addDaysNZ(cursor, 1)
  }
  return counts
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCancelled = toBool(searchParams.get('includeCancelled'), false)
    const includeUnpaid = toBool(searchParams.get('includeUnpaid'), false)
    const useBusinessDate = toBool(searchParams.get('useBusinessDate'), true)
    const includeAll = toBool(searchParams.get('includeAll'), false)

    const end = new Date()
    const start7 = parseRangePreset('7D', end).start
    const start30 = parseRangePreset('30D', end).start
    const start6m = parseRangePreset('6M', end).start
    const start12m = parseRangePreset('12M', end).start

    const limitedStart = start12m
    const orderDateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const orders = await prisma.order.findMany({
      where: {
        [orderDateKey]: { gte: includeAll ? undefined : limitedStart, lte: end },
      } as any,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        totalPrice: true,
        lineItems: true,
        financialStatus: true,
        cancelledAt: true,
        createdAt: true,
        processedAt: true,
        deliveryDateResolved: true,
      },
    })

    const filtered = orders.filter(o => shouldIncludeOrder(o, { includeCancelled, includeUnpaid }))

    const starts: Record<Exclude<WindowKey, 'ALL'>, Date> = {
      '7D': start7,
      '30D': start30,
      '6M': start6m,
      '12M': start12m,
    }

    let allStart = end
    if (filtered.length > 0) {
      let min = Number.POSITIVE_INFINITY
      for (const o of filtered) {
        const when = useBusinessDate ? resolveBusinessDate(o) : new Date(o.createdAt as any)
        const t = when.getTime()
        if (Number.isFinite(t) && t < min) min = t
      }
      if (Number.isFinite(min)) allStart = new Date(min)
    }

    const windows: Array<{ key: WindowKey; start: Date; end: Date }> = [
      { key: '7D', start: starts['7D'], end },
      { key: '30D', start: starts['30D'], end },
      { key: '6M', start: starts['6M'], end },
      { key: '12M', start: starts['12M'], end },
    ]
    if (includeAll) windows.push({ key: 'ALL', start: allStart, end })

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const totalsByWindow: Record<WindowKey, { revenue: number[]; cogs: number[]; staffing: number[]; orders: number[] }> = {
      '7D': { revenue: [0, 0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0, 0], staffing: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] },
      '30D': { revenue: [0, 0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0, 0], staffing: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] },
      '6M': { revenue: [0, 0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0, 0], staffing: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] },
      '12M': { revenue: [0, 0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0, 0], staffing: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] },
      'ALL': { revenue: [0, 0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0, 0], staffing: [0, 0, 0, 0, 0, 0, 0], orders: [0, 0, 0, 0, 0, 0, 0] },
    }

    const allLis = filtered.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(allLis.map((it: any) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allLis.map((it: any) => String(it?.sku || '')).filter(Boolean)))
    const maps = await collectVariantCosts(variantIds, skus)

    for (const o of filtered) {
      const when = useBusinessDate ? resolveBusinessDate(o) : new Date(o.createdAt as any)
      const ts = when.getTime()
      if (!Number.isFinite(ts)) continue
      const ymd = formatNZYMD(when)
      const wIdx = weekdayIndexFromYmd(ymd)
      const revenue = Number(o.totalPrice || 0)
      const cogs = sumItemsCost(parseLineItems(o.lineItems), maps)
      for (const w of windows) {
        if (ts >= w.start.getTime() && ts <= w.end.getTime()) {
          totalsByWindow[w.key].revenue[wIdx] += revenue
          totalsByWindow[w.key].cogs[wIdx] += cogs
          totalsByWindow[w.key].orders[wIdx] += 1
        }
      }
    }

    const shifts = await prisma.shift.findMany({
      where: { date: { gte: includeAll ? undefined : limitedStart, lte: end } },
      include: { staff: true },
      orderBy: { date: 'asc' },
    })

    for (const s of shifts as any[]) {
      const when = new Date(s.date)
      const ts = when.getTime()
      if (!Number.isFinite(ts)) continue
      const ymd = formatNZYMD(when)
      const wIdx = weekdayIndexFromYmd(ymd)
      let hours: number | null = typeof s.totalHours === 'number' ? s.totalHours : null
      if (hours == null) {
        if (s.clockIn && s.clockOut) {
          const diffMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
          hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
        } else {
          hours = 0
        }
      }
      const pay = Number(s?.staff?.payRate || 0)
      const staffingCost = pay * (hours || 0)
      for (const w of windows) {
        if (ts >= w.start.getTime() && ts <= w.end.getTime()) {
          totalsByWindow[w.key].staffing[wIdx] += staffingCost
        }
      }
    }

    const dayCountsByWindow: Record<WindowKey, number[]> = {
      '7D': countWeekdaysInRange(start7, end),
      '30D': countWeekdaysInRange(start30, end),
      '6M': countWeekdaysInRange(start6m, end),
      '12M': countWeekdaysInRange(start12m, end),
      'ALL': includeAll ? countWeekdaysInRange(allStart, end) : [0, 0, 0, 0, 0, 0, 0],
    }

    const byWindow = windows.reduce((acc, w) => {
      const dayCounts = dayCountsByWindow[w.key]
      const rows = weekdayLabels.map((weekday, i) => {
        const totalRevenue = Number(totalsByWindow[w.key].revenue[i].toFixed(2))
        const totalCogs = Number(totalsByWindow[w.key].cogs[i].toFixed(2))
        const totalStaffing = Number(totalsByWindow[w.key].staffing[i].toFixed(2))
        const totalOrders = totalsByWindow[w.key].orders[i]
        const denom = Math.max(1, dayCounts[i])
        const avgRevenue = Number((totalRevenue / denom).toFixed(2))
        const avgCogs = Number((totalCogs / denom).toFixed(2))
        const avgStaffing = Number((totalStaffing / denom).toFixed(2))
        const avgGrossProfit = Number((avgRevenue - avgCogs).toFixed(2))
        const avgGpAfterStaffing = Number((avgGrossProfit - avgStaffing).toFixed(2))
        return {
          weekday,
          totalRevenue,
          totalCogs,
          totalStaffing,
          totalOrders,
          avgRevenue,
          avgCogs,
          avgStaffing,
          avgGrossProfit,
          avgGpAfterStaffing,
          avgOrders: Number((totalOrders / denom).toFixed(2)),
          dayCount: dayCounts[i],
        }
      })
      acc[w.key] = rows
      return acc
    }, {} as Record<WindowKey, Array<{ weekday: string; totalRevenue: number; totalCogs: number; totalStaffing: number; totalOrders: number; avgRevenue: number; avgCogs: number; avgStaffing: number; avgGrossProfit: number; avgGpAfterStaffing: number; avgOrders: number; dayCount: number }>>)

    const summaryByWindow = windows.reduce((acc, w) => {
      const dayCounts = dayCountsByWindow[w.key]
      const totalDays = dayCounts.reduce((s, n) => s + n, 0)
      const revenue = totalsByWindow[w.key].revenue.reduce((s, n) => s + n, 0)
      const cogs = totalsByWindow[w.key].cogs.reduce((s, n) => s + n, 0)
      const staffing = totalsByWindow[w.key].staffing.reduce((s, n) => s + n, 0)
      const denom = Math.max(1, totalDays)
      const avgRevenue = Number((revenue / denom).toFixed(2))
      const avgCogs = Number((cogs / denom).toFixed(2))
      const avgStaffing = Number((staffing / denom).toFixed(2))
      const avgGrossProfit = Number((avgRevenue - avgCogs).toFixed(2))
      const avgGpAfterStaffing = Number((avgGrossProfit - avgStaffing).toFixed(2))
      acc[w.key] = {
        avgRevenue,
        avgCogs,
        avgStaffing,
        avgGrossProfit,
        avgGpAfterStaffing,
      }
      return acc
    }, {} as Record<WindowKey, { avgRevenue: number; avgCogs: number; avgStaffing: number; avgGrossProfit: number; avgGpAfterStaffing: number }>)

    return NextResponse.json({
      params: { includeCancelled, includeUnpaid, useBusinessDate },
      windows: windows.map(w => w.key),
      weekdays: weekdayLabels,
      byWindow,
      summaryByWindow,
    })
  } catch (error) {
    console.error('❌ Error in sales-by-weekday:', error)
    return NextResponse.json({ error: 'Failed to compute sales by weekday' }, { status: 500 })
  }
}
