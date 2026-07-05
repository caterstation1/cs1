import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseRangePreset,
  resolveBusinessDate,
  parseLineItems,
  collectVariantCosts,
  sumItemsCost,
  bucketKey,
  shouldIncludeOrder,
  calcCogsCoverage,
  fetchShiftLabour,
} from '@/lib/accounting'

function toBool(v: string | null, def = false): boolean {
  if (v == null) return def
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rangePreset = (searchParams.get('rangePreset') || '30D') as any
    const includeCancelled = toBool(searchParams.get('includeCancelled'), false)
    const includeUnpaid = toBool(searchParams.get('includeUnpaid'), false)
    const useBusinessDate = toBool(searchParams.get('useBusinessDate'), true)

    const { start, end, bucket } = parseRangePreset(rangePreset)

    // Build base where by chosen date key
    const dateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const where: any = {
      [dateKey]: { gte: start, lte: end },
    }
    if (!includeCancelled) where.cancelledAt = null
    if (!includeUnpaid) where.financialStatus = { in: ['paid', 'partially_paid'] }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { [dateKey]: 'asc' },
      select: {
        id: true,
        totalPrice: true,
        subtotalPrice: true,
        financialStatus: true,
        cancelledAt: true,
        createdAt: true,
        processedAt: true,
        deliveryDateResolved: true,
        lineItems: true,
      },
    })

    // Final filter guard
    const filtered = orders.filter(o => shouldIncludeOrder(o, { includeCancelled, includeUnpaid }))

    // Prepare cost maps
    const allLis = filtered.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(allLis.map((it: any) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allLis.map((it: any) => String(it?.sku || '')).filter(Boolean)))
    const maps = await collectVariantCosts(variantIds, skus)

    // Bucket aggregations
    const buckets = new Map<string, { revenue: number; cogs: number }>()
    let revenueTotal = 0
    let cogsTotal = 0
    for (const o of filtered) {
      const when = useBusinessDate ? resolveBusinessDate(o) : new Date(o.createdAt as any)
      const key = bucketKey(when, bucket)
      const got = buckets.get(key) || { revenue: 0, cogs: 0 }
      const items = parseLineItems(o.lineItems)
      const c = sumItemsCost(items, maps)
      const r = Number(o.totalPrice || 0)
      got.revenue += r
      got.cogs += c
      revenueTotal += r
      cogsTotal += c
      buckets.set(key, got)
    }

    const series = Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, v]) => {
        const gp = Number((v.revenue - v.cogs).toFixed(2))
        const gm = v.revenue > 0 ? Number(((gp / v.revenue) * 100).toFixed(1)) : 0
        return { date, revenue: Number(v.revenue.toFixed(2)), cogs: Number(v.cogs.toFixed(2)), grossProfit: gp, grossMarginPct: gm }
      })

    const grossProfit = Number((revenueTotal - cogsTotal).toFixed(2))
    const grossMarginPct = revenueTotal > 0 ? Number(((grossProfit / revenueTotal) * 100).toFixed(1)) : 0

    const coverage = calcCogsCoverage(filtered, maps)

    // Labour by matching bucket so we can show profit after staffing on the same trend.
    const shiftLabour = await fetchShiftLabour(start, end)
    const labourByBucket = new Map<string, number>()
    let labourTotal = 0
    for (const entry of shiftLabour) {
      const key = bucketKey(entry.date, bucket)
      labourByBucket.set(key, Number(((labourByBucket.get(key) || 0) + entry.cost).toFixed(2)))
      labourTotal += entry.cost
    }

    const seriesWithLabour = series.map(point => {
      const labourCost = Number((labourByBucket.get(point.date) || 0).toFixed(2))
      const netProfitAfterStaffing = Number((point.grossProfit - labourCost).toFixed(2))
      const netMarginAfterStaffingPct = point.revenue > 0
        ? Number(((netProfitAfterStaffing / point.revenue) * 100).toFixed(1))
        : 0
      return {
        ...point,
        labourCost,
        netProfitAfterStaffing,
        netMarginAfterStaffingPct,
      }
    })
    const netProfitAfterStaffingTotal = Number((grossProfit - labourTotal).toFixed(2))
    const netMarginAfterStaffingPct = revenueTotal > 0
      ? Number(((netProfitAfterStaffingTotal / revenueTotal) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      params: { rangePreset, includeCancelled, includeUnpaid, useBusinessDate, bucket },
      kpis: {
        revenue: Number(revenueTotal.toFixed(2)),
        cogs: Number(cogsTotal.toFixed(2)),
        grossProfit,
        grossMarginPct,
        labourCost: Number(labourTotal.toFixed(2)),
        netProfitAfterStaffing: netProfitAfterStaffingTotal,
        netMarginAfterStaffingPct,
        cogsCoveragePct: coverage.pct,
      },
      series: seriesWithLabour,
    })
  } catch (error) {
    console.error('❌ Error in sales-profit-trend:', error)
    return NextResponse.json({ error: 'Failed to build sales vs profit trend' }, { status: 500 })
  }
}

