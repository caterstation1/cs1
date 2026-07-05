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
  groupKeyForOrder,
  fetchDeliveryPayouts,
  resolveDeliveryCost,
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
    const groupBy = (searchParams.get('groupBy') || 'suburb') as 'zone' | 'suburb' | 'postcode'
    const sortBy = (searchParams.get('sortBy') || 'revenue') as 'revenue' | 'profit'

    const { start, end } = parseRangePreset(rangePreset)
    const dateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const where: any = { [dateKey]: { gte: start, lte: end } }
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
        shippingAddress: true,
      },
    })

    const filtered = orders.filter(o => shouldIncludeOrder(o, { includeCancelled, includeUnpaid }))

    // Cost maps
    const allLis = filtered.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(allLis.map((it: any) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allLis.map((it: any) => String(it?.sku || '')).filter(Boolean)))
    const maps = await collectVariantCosts(variantIds, skus)

    // Delivery job payouts as fallback delivery cost
    const payoutByOrderId = await fetchDeliveryPayouts(filtered.map(o => o.id))

    const groups = new Map<
      string,
      { name: string; ordersCount: number; revenue: number; cogs: number; deliveryCost: number }
    >()

    for (const o of filtered) {
      const key = groupKeyForOrder(o, groupBy)
      const g = groups.get(key) || { name: key, ordersCount: 0, revenue: 0, cogs: 0, deliveryCost: 0 }
      const items = parseLineItems(o.lineItems)
      const cogs = sumItemsCost(items, maps)
      const revenue = Number(o.totalPrice || 0)
      // Delivery cost precedence A: shipping diff -> sum(shippingLines) -> DeliveryJob.payout -> not available(0)
      const deliveryCost = resolveDeliveryCost(o, payoutByOrderId)

      g.ordersCount += 1
      g.revenue += revenue
      g.cogs += cogs
      g.deliveryCost += deliveryCost
      groups.set(key, g)
    }

    const rows = Array.from(groups.values()).map(g => {
      const profit = Number((g.revenue - g.cogs - g.deliveryCost).toFixed(2))
      const marginPct = g.revenue > 0 ? Number(((profit / g.revenue) * 100).toFixed(1)) : 0
      const avgDeliveryCost = g.ordersCount > 0 ? Number((g.deliveryCost / g.ordersCount).toFixed(2)) : 0
      return {
        ...g,
        revenue: Number(g.revenue.toFixed(2)),
        cogs: Number(g.cogs.toFixed(2)),
        deliveryCost: Number(g.deliveryCost.toFixed(2)),
        profit,
        marginPct,
        avgDeliveryCost,
      }
    })

    rows.sort((a, b) => (sortBy === 'profit' ? b.profit - a.profit : b.revenue - a.revenue))
    const top = rows.slice(0, 20)

    const bar = top.map(r => ({ name: r.name, revenue: r.revenue, profit: r.profit }))

    return NextResponse.json({
      params: { rangePreset, includeCancelled, includeUnpaid, useBusinessDate, groupBy, sortBy },
      top,
      bar,
    })
  } catch (error) {
    console.error('❌ Error in delivery-profitability:', error)
    return NextResponse.json({ error: 'Failed to compute delivery profitability' }, { status: 500 })
  }
}

