import { prisma } from '@/lib/prisma'
import {
  collectVariantCosts,
  parseLineItems,
  shouldIncludeOrder,
  sumItemsCost,
} from '@/lib/accounting'
import { ResolvedPeriod } from './periods'
import { formatLocalDate } from '@/lib/date-utils'

export interface SalesKpis {
  periodLabel: string
  orderCount: number
  revenueExGst: number
  revenueIncGst: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
}

function revenueExGstFromOrder(o: { totalPrice?: unknown }): number {
  const inc = Number(o.totalPrice || 0)
  return isFinite(inc) ? Number((inc / 1.15).toFixed(2)) : 0
}

async function aggregateOrders(orders: Awaited<ReturnType<typeof fetchPaidOrders>>): Promise<Omit<SalesKpis, 'periodLabel'>> {
  const allLis = orders.flatMap((o) => parseLineItems(o.lineItems))
  const variantIds = Array.from(
    new Set(allLis.map((it: { variant_id?: string; variantId?: string }) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)),
  )
  const skus = Array.from(new Set(allLis.map((it: { sku?: string }) => String(it?.sku || '')).filter(Boolean)))
  const maps = await collectVariantCosts(variantIds, skus)

  let revenueExGst = 0
  let revenueIncGst = 0
  let cogs = 0

  for (const o of orders) {
    const inc = Number(o.totalPrice || 0)
    revenueIncGst += isFinite(inc) ? inc : 0
    revenueExGst += revenueExGstFromOrder(o)
    cogs += sumItemsCost(parseLineItems(o.lineItems), maps)
  }

  revenueExGst = Number(revenueExGst.toFixed(2))
  revenueIncGst = Number(revenueIncGst.toFixed(2))
  cogs = Number(cogs.toFixed(2))
  const grossProfit = Number((revenueExGst - cogs).toFixed(2))
  const grossMarginPct = revenueExGst > 0 ? Number(((grossProfit / revenueExGst) * 100).toFixed(1)) : 0

  return {
    orderCount: orders.length,
    revenueExGst,
    revenueIncGst,
    cogs,
    grossProfit,
    grossMarginPct,
  }
}

async function fetchPaidOrders(period: ResolvedPeriod) {
  if (period.dateField === 'deliveryDate') {
    const startYmd = formatLocalDate(period.start)
    const endYmd = formatLocalDate(period.end)
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: startYmd, lte: endYmd },
        cancelledAt: null,
        financialStatus: { in: ['paid', 'partially_paid'] },
      },
      select: {
        id: true,
        totalPrice: true,
        subtotalPrice: true,
        financialStatus: true,
        cancelledAt: true,
        lineItems: true,
        createdAt: true,
        deliveryDateResolved: true,
        processedAt: true,
      },
    })
    return orders.filter((o) => shouldIncludeOrder(o, { includeCancelled: false, includeUnpaid: false }))
  }

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      cancelledAt: null,
      financialStatus: { in: ['paid', 'partially_paid'] },
    },
    select: {
      id: true,
      totalPrice: true,
      subtotalPrice: true,
      financialStatus: true,
      cancelledAt: true,
      lineItems: true,
      createdAt: true,
      deliveryDateResolved: true,
      processedAt: true,
    },
  })
  return orders.filter((o) => shouldIncludeOrder(o, { includeCancelled: false, includeUnpaid: false }))
}

export async function getSalesKpisForPeriod(period: ResolvedPeriod): Promise<SalesKpis> {
  const orders = await fetchPaidOrders(period)
  const agg = await aggregateOrders(orders)
  return { periodLabel: period.label, ...agg }
}

export interface PeriodComparison {
  current: SalesKpis
  compare: SalesKpis
  deltaRevenueExGst: number
  deltaRevenuePct: number | null
  deltaOrderCount: number
  summary: string
}

export async function compareSalesPeriods(
  current: ResolvedPeriod,
  compare: ResolvedPeriod,
): Promise<PeriodComparison> {
  const [currentKpis, compareKpis] = await Promise.all([
    getSalesKpisForPeriod(current),
    getSalesKpisForPeriod(compare),
  ])

  const deltaRevenueExGst = Number((currentKpis.revenueExGst - compareKpis.revenueExGst).toFixed(2))
  const deltaRevenuePct =
    compareKpis.revenueExGst > 0
      ? Number(((deltaRevenueExGst / compareKpis.revenueExGst) * 100).toFixed(1))
      : null
  const deltaOrderCount = currentKpis.orderCount - compareKpis.orderCount

  const direction = deltaRevenueExGst >= 0 ? 'up' : 'down'
  const pctStr = deltaRevenuePct != null ? ` (${deltaRevenuePct >= 0 ? '+' : ''}${deltaRevenuePct}%)` : ''
  const summary = `${current.label}: $${currentKpis.revenueExGst.toLocaleString()} ex GST (${currentKpis.orderCount} orders) vs ${compare.label}: $${compareKpis.revenueExGst.toLocaleString()} (${compareKpis.orderCount} orders) — ${direction} $${Math.abs(deltaRevenueExGst).toLocaleString()}${pctStr}`

  return {
    current: currentKpis,
    compare: compareKpis,
    deltaRevenueExGst,
    deltaRevenuePct,
    deltaOrderCount,
    summary,
  }
}
