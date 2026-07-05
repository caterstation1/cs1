import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import {
  parseLineItems,
  collectVariantCosts,
  sumItemsCost,
  calcCogsCoverage,
  shouldIncludeOrder,
  fetchShiftLabour,
  fetchDeliveryPayouts,
  resolveDeliveryCost,
} from '@/lib/accounting'
import { getTodayLocal, formatLocalDate, formatNZYMD, getNZDateRangeForYmd, addDaysNZ } from '@/lib/date-utils'
import { isWellingtonOrder } from '@/lib/region'

export type OpsPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_CUSTOM_DAYS = 92

function mondayOfWeek(ymd: string): string {
  const day = new Date(`${ymd}T12:00:00Z`).getUTCDay() // noon UTC avoids DST edge for weekday calc
  const diffToMonday = day === 0 ? 6 : day - 1
  return addDaysNZ(ymd, -diffToMonday)
}

function resolvePeriod(preset: OpsPreset, startParam: string | null, endParam: string | null): {
  startYmd: string
  endYmd: string
} {
  const todayYmd = formatLocalDate(getTodayLocal())
  switch (preset) {
    case 'today':
      return { startYmd: todayYmd, endYmd: todayYmd }
    case 'yesterday': {
      const y = addDaysNZ(todayYmd, -1)
      return { startYmd: y, endYmd: y }
    }
    case 'this_week': {
      const mon = mondayOfWeek(todayYmd)
      return { startYmd: mon, endYmd: addDaysNZ(mon, 6) }
    }
    case 'last_week': {
      const mon = addDaysNZ(mondayOfWeek(todayYmd), -7)
      return { startYmd: mon, endYmd: addDaysNZ(mon, 6) }
    }
    case 'this_month': {
      const first = `${todayYmd.slice(0, 7)}-01`
      const nextMonthFirst = firstOfNextMonth(first)
      return { startYmd: first, endYmd: addDaysNZ(nextMonthFirst, -1) }
    }
    case 'last_month': {
      const firstThis = `${todayYmd.slice(0, 7)}-01`
      const lastPrev = addDaysNZ(firstThis, -1)
      const firstPrev = `${lastPrev.slice(0, 7)}-01`
      return { startYmd: firstPrev, endYmd: lastPrev }
    }
    case 'custom': {
      const startYmd = startParam && YMD_RE.test(startParam) ? startParam : addDaysNZ(todayYmd, -6)
      const endYmd = endParam && YMD_RE.test(endParam) ? endParam : todayYmd
      return startYmd <= endYmd ? { startYmd, endYmd } : { startYmd: endYmd, endYmd: startYmd }
    }
    default:
      return { startYmd: addDaysNZ(todayYmd, -6), endYmd: todayYmd }
  }
}

function firstOfNextMonth(firstYmd: string): string {
  const [y, m] = firstYmd.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

function orderRegion(o: any): 'AKL' | 'WLG' | 'OTHER' {
  const r = String(o?.region || '').toUpperCase()
  if (r === 'AKL' || r === 'WLG') return r
  if (r === 'OTHER') return 'OTHER'
  // Fallback for orders without a canonical region
  return isWellingtonOrder(o) ? 'WLG' : 'AKL'
}

function countItems(items: any[]): number {
  return items.reduce((s, li) => {
    const q = Number(li?.quantity || 0)
    return s + (isFinite(q) ? q : 0)
  }, 0)
}

const round2 = (n: number) => Number(n.toFixed(2))
const pct1 = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0)

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin', 'manager'])
    const sp = req.nextUrl.searchParams
    const preset = (sp.get('preset') || 'this_week') as OpsPreset
    const regionFilter = (sp.get('region') || '').toUpperCase()
    const { startYmd, endYmd } = resolvePeriod(preset, sp.get('startDate'), sp.get('endDate'))

    // Cap runaway custom ranges
    const dayList: string[] = []
    for (let d = startYmd; d <= endYmd && dayList.length < MAX_CUSTOM_DAYS; d = addDaysNZ(d, 1)) {
      dayList.push(d)
    }
    const effectiveEndYmd = dayList[dayList.length - 1]

    const { start } = getNZDateRangeForYmd(startYmd)
    const { end } = getNZDateRangeForYmd(effectiveEndYmd)

    const orders = await prisma.order.findMany({
      where: {
        deliveryDateResolved: { gte: start, lte: end },
        cancelledAt: null,
        financialStatus: { in: ['paid', 'partially_paid'] },
      },
      select: {
        id: true,
        totalPrice: true,
        subtotalPrice: true,
        financialStatus: true,
        cancelledAt: true,
        createdAt: true,
        deliveryDateResolved: true,
        region: true,
        shippingAddress: true,
        lineItems: true,
      },
    })

    const included = orders
      .filter(o => shouldIncludeOrder(o, {}))
      .filter(o => {
        if (regionFilter !== 'AKL' && regionFilter !== 'WLG') return true
        return orderRegion(o) === regionFilter
      })

    // COGS cost maps
    const allLis = included.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(allLis.map((it: any) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allLis.map((it: any) => String(it?.sku || '')).filter(Boolean)))
    const maps = await collectVariantCosts(variantIds, skus)
    const payoutByOrderId = await fetchDeliveryPayouts(included.map(o => o.id))

    // Labour (shifts are company-wide; not filterable by delivery region)
    const shiftLabour = await fetchShiftLabour(start, end)

    type DayAgg = {
      deliveries: number
      items: number
      revenue: number
      cogs: number
      deliveryCost: number
      opsLabourCost: number
      opsLabourHours: number
      adminLabourCost: number
      adminLabourHours: number
    }
    const emptyDay = (): DayAgg => ({
      deliveries: 0,
      items: 0,
      revenue: 0,
      cogs: 0,
      deliveryCost: 0,
      opsLabourCost: 0,
      opsLabourHours: 0,
      adminLabourCost: 0,
      adminLabourHours: 0,
    })
    const byDay = new Map<string, DayAgg>()
    for (const d of dayList) byDay.set(d, emptyDay())

    type RegionAgg = { region: string; deliveries: number; items: number; revenue: number; cogs: number; deliveryCost: number }
    const byRegion = new Map<string, RegionAgg>()

    for (const o of included) {
      const ymd = o.deliveryDateResolved ? formatNZYMD(new Date(o.deliveryDateResolved)) : null
      const day = ymd ? byDay.get(ymd) : undefined
      const items = parseLineItems(o.lineItems)
      const revenue = Number(o.totalPrice || 0)
      const cogs = sumItemsCost(items, maps)
      const deliveryCost = resolveDeliveryCost(o, payoutByOrderId)
      const itemCount = countItems(items)

      if (day) {
        day.deliveries += 1
        day.items += itemCount
        day.revenue += revenue
        day.cogs += cogs
        day.deliveryCost += deliveryCost
      }

      const region = orderRegion(o)
      const r = byRegion.get(region) || { region, deliveries: 0, items: 0, revenue: 0, cogs: 0, deliveryCost: 0 }
      r.deliveries += 1
      r.items += itemCount
      r.revenue += revenue
      r.cogs += cogs
      r.deliveryCost += deliveryCost
      byRegion.set(region, r)
    }

    for (const entry of shiftLabour) {
      const ymd = formatNZYMD(entry.date)
      const day = byDay.get(ymd)
      if (!day) continue
      if (entry.includeInOpsLabour) {
        day.opsLabourCost += entry.cost
        day.opsLabourHours += entry.hours
      } else {
        day.adminLabourCost += entry.cost
        day.adminLabourHours += entry.hours
      }
    }

    // Totals
    const totals = emptyDay()
    for (const day of byDay.values()) {
      totals.deliveries += day.deliveries
      totals.items += day.items
      totals.revenue += day.revenue
      totals.cogs += day.cogs
      totals.deliveryCost += day.deliveryCost
      totals.opsLabourCost += day.opsLabourCost
      totals.opsLabourHours += day.opsLabourHours
      totals.adminLabourCost += day.adminLabourCost
      totals.adminLabourHours += day.adminLabourHours
    }

    const coverage = calcCogsCoverage(included, maps)
    const grossProfit = round2(totals.revenue - totals.cogs)
    const netOperationalProfit = round2(grossProfit - totals.opsLabourCost - totals.deliveryCost)
    const totalOpsCost = totals.cogs + totals.opsLabourCost + totals.deliveryCost

    const kpis = {
      deliveries: totals.deliveries,
      itemsOut: totals.items,
      revenue: round2(totals.revenue),
      avgOrderValue: totals.deliveries > 0 ? round2(totals.revenue / totals.deliveries) : 0,
      cogs: round2(totals.cogs),
      cogsCoveragePct: coverage.pct,
      labourCost: round2(totals.opsLabourCost),
      labourHours: round2(totals.opsLabourHours),
      adminLabourCost: round2(totals.adminLabourCost),
      adminLabourHours: round2(totals.adminLabourHours),
      deliveryCost: round2(totals.deliveryCost),
      grossProfit,
      grossMarginPct: pct1(grossProfit, totals.revenue),
      netOperationalProfit,
      netOperationalMarginPct: pct1(netOperationalProfit, totals.revenue),
      labourPctOfRevenue: pct1(totals.opsLabourCost, totals.revenue),
      revenuePerLabourHour: totals.opsLabourHours > 0 ? round2(totals.revenue / totals.opsLabourHours) : 0,
      deliveriesPerLabourHour: totals.opsLabourHours > 0 ? round2(totals.deliveries / totals.opsLabourHours) : 0,
      costPerDelivery: totals.deliveries > 0 ? round2(totalOpsCost / totals.deliveries) : 0,
    }

    const dailySeries = dayList.map(ymd => {
      const day = byDay.get(ymd) || emptyDay()
      const dayGross = day.revenue - day.cogs
      return {
        date: ymd,
        deliveries: day.deliveries,
        revenue: round2(day.revenue),
        cogs: round2(day.cogs),
        labourCost: round2(day.opsLabourCost),
        deliveryCost: round2(day.deliveryCost),
        netProfit: round2(dayGross - day.opsLabourCost - day.deliveryCost),
      }
    })

    const regionBreakdown = Array.from(byRegion.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map(r => ({
        region: r.region,
        deliveries: r.deliveries,
        items: r.items,
        revenue: round2(r.revenue),
        cogs: round2(r.cogs),
        deliveryCost: round2(r.deliveryCost),
      }))

    return NextResponse.json({
      params: {
        preset,
        region: regionFilter === 'AKL' || regionFilter === 'WLG' ? regionFilter : null,
        startDate: startYmd,
        endDate: effectiveEndYmd,
      },
      // Shifts have no region link, so labour always covers the whole company
      labourIsCompanyWide: true,
      kpis,
      regionBreakdown,
      dailySeries,
    })
  } catch (error: any) {
    if (error?.status === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('❌ Error in operations-summary:', error)
    return NextResponse.json({ error: 'Failed to load operations summary' }, { status: 500 })
  }
}
