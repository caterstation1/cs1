// Freezing cost of sales for completed delivery days.
//
// Costing follows live supplier pricing, so without this a day's COGS keeps
// moving for as long as the business exists. Rather than asking someone to
// press a button every morning, an owner sets a single "lock from" date once
// recipe pricing is trusted; every completed delivery day on or after it is
// then locked automatically at the prices in effect just after dispatch.

import { prisma } from '@/lib/prisma'
import { formatNZYMD, addDaysNZ } from '@/lib/date-utils'
import { buildCogsIndex, lineItemRefs, revenueExGst, round2, sumOrderCogs } from '@/lib/cogs'

export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** DATE columns are addressed at UTC midnight. */
export function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayNZ(): string {
  return formatNZYMD(new Date())
}

export interface DayCogs {
  revenueExGst: number
  costOfSales: number
  orderCount: number
  cogsCoveragePct: number
  uncostedQty: number
  breakdown: Array<Record<string, unknown>>
}

/** Cost of sales for one delivery day at current prices. */
export async function computeDayCogs(ymd: string): Promise<DayCogs> {
  const orders = await prisma.order.findMany({
    where: { deliveryDateResolved: utcMidnight(ymd), cancelledAt: null },
    select: { orderNumber: true, totalPrice: true, lineItems: true },
  })

  const refs = lineItemRefs(orders)
  const index = await buildCogsIndex(refs.variantIds, refs.skus)

  let revenue = 0
  let cogs = 0
  let missingQty = 0
  let totalQty = 0
  const breakdown: Array<Record<string, unknown>> = []

  for (const order of orders) {
    revenue += revenueExGst(order)
    const result = sumOrderCogs(order, index)
    cogs += result.cogs
    missingQty += result.missingQty
    totalQty += result.totalQty
    for (const line of result.lines) {
      breakdown.push({
        orderNumber: Number(order.orderNumber || 0),
        sku: line.sku,
        variantId: line.variantId,
        name: line.name,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineCost: line.lineCost,
        source: line.source,
      })
    }
  }

  return {
    revenueExGst: round2(revenue),
    costOfSales: round2(cogs),
    orderCount: orders.length,
    cogsCoveragePct: totalQty > 0 ? Math.round(((totalQty - missingQty) / totalQty) * 100) : 100,
    uncostedQty: missingQty,
    breakdown,
  }
}

export async function lockDay(
  ymd: string,
  lockedBy: { userId?: string | null; name?: string | null } = {}
): Promise<DayCogs> {
  const computed = await computeDayCogs(ymd)
  const payload = {
    revenueExGst: computed.revenueExGst,
    costOfSales: computed.costOfSales,
    orderCount: computed.orderCount,
    cogsCoveragePct: computed.cogsCoveragePct,
    breakdown: computed.breakdown as any,
    lockedAt: new Date(),
    lockedByUserId: lockedBy.userId ?? null,
    lockedByName: lockedBy.name ?? null,
  }
  await prisma.dailyCogsLock.upsert({
    where: { date: utcMidnight(ymd) },
    create: { date: utcMidnight(ymd), ...payload },
    update: payload,
  })
  return computed
}

export async function getCogsLockFrom(): Promise<string | null> {
  const settings = await prisma.pricingSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.cogsLockFromDate ? toYmd(settings.cogsLockFromDate) : null
}

export async function setCogsLockFrom(ymd: string | null): Promise<string | null> {
  const value = ymd ? utcMidnight(ymd) : null
  const settings = await prisma.pricingSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', cogsLockFromDate: value },
    update: { cogsLockFromDate: value },
  })
  return settings.cogsLockFromDate ? toYmd(settings.cogsLockFromDate) : null
}

export interface AutoLockResult {
  lockFrom: string | null
  /** Days newly frozen by this run. */
  locked: string[]
  /** Completed days still awaiting a lock because the batch limit was hit. */
  remaining: number
  skippedNoOrders: string[]
}

/**
 * Locks every completed delivery day from the configured date up to yesterday
 * that is not already locked. Today is never locked: it has not finished
 * dispatching, and its cost should still track live pricing.
 *
 * `limit` bounds the work so this can be called from a request path safely;
 * the cron and the settings save pass a large limit to catch up in one go.
 */
export async function autoLockCompletedDays(options: { limit?: number } = {}): Promise<AutoLockResult> {
  const limit = options.limit ?? 5
  const lockFrom = await getCogsLockFrom()
  if (!lockFrom) return { lockFrom: null, locked: [], remaining: 0, skippedNoOrders: [] }

  const lastCompleted = addDaysNZ(todayNZ(), -1)
  if (lastCompleted < lockFrom) return { lockFrom, locked: [], remaining: 0, skippedNoOrders: [] }

  // Only days that actually had deliveries are worth a lock row.
  const [daysWithOrders, existing] = await Promise.all([
    prisma.order.findMany({
      where: {
        deliveryDateResolved: { gte: utcMidnight(lockFrom), lte: utcMidnight(lastCompleted) },
        cancelledAt: null,
      },
      distinct: ['deliveryDateResolved'],
      select: { deliveryDateResolved: true },
    }),
    prisma.dailyCogsLock.findMany({
      where: { date: { gte: utcMidnight(lockFrom), lte: utcMidnight(lastCompleted) } },
      select: { date: true },
    }),
  ])

  const locked = new Set(existing.map((l) => toYmd(l.date)))
  const outstanding = daysWithOrders
    .map((o) => (o.deliveryDateResolved ? toYmd(o.deliveryDateResolved) : null))
    .filter((ymd): ymd is string => !!ymd && !locked.has(ymd))
    .sort()

  const batch = outstanding.slice(0, limit)
  const newlyLocked: string[] = []
  for (const ymd of batch) {
    await lockDay(ymd, { name: 'Automatic (cost lock from date)' })
    newlyLocked.push(ymd)
  }

  return {
    lockFrom,
    locked: newlyLocked,
    remaining: Math.max(0, outstanding.length - batch.length),
    skippedNoOrders: [],
  }
}
