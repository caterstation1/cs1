import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate, addDaysNZ } from '@/lib/date-utils'
import { buildCogsIndex, lineItemRefs, round2, sumOrderCogs } from '@/lib/cogs'

// The year period expands every line of ~1,700 orders.
export const maxDuration = 60

function getPeriodRange(period: string): { startStr: string; endStr: string } {
  const todayStr = formatLocalDate(getTodayLocal())
  if (period === 'yesterday') {
    const y = addDaysNZ(todayStr, -1)
    return { startStr: y, endStr: y }
  }
  if (period === 'week') {
    const dow = getTodayLocal().getDay()
    const daysToMonday = dow === 0 ? 6 : dow - 1
    return { startStr: addDaysNZ(todayStr, -daysToMonday), endStr: todayStr }
  }
  if (period === 'month') return { startStr: `${todayStr.slice(0, 7)}-01`, endStr: todayStr }
  if (period === 'year') return { startStr: `${todayStr.slice(0, 4)}-01-01`, endStr: todayStr }
  return { startStr: todayStr, endStr: todayStr }
}

/** `deliveryDateResolved` is a DATE column, addressed at UTC midnight. */
function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') || 'today').toLowerCase()
    const qStart = (searchParams.get('start') || '').trim()
    const qEnd = (searchParams.get('end') || '').trim()
    let { startStr, endStr } = getPeriodRange(period)
    if (/^\d{4}-\d{2}-\d{2}$/.test(qStart)) {
      startStr = qStart
      endStr = /^\d{4}-\d{2}-\d{2}$/.test(qEnd) ? qEnd : qStart
    }

    // Delivery-day basis, matching the cards below the graph. Cancelled orders
    // are not sales, so they carry no cost of sales either.
    const orders = await prisma.order.findMany({
      where: {
        deliveryDateResolved: { gte: utcMidnight(startStr), lte: utcMidnight(endStr) },
        cancelledAt: null,
      },
      select: { id: true, orderNumber: true, lineItems: true },
    })

    const refs = lineItemRefs(orders)
    const index = await buildCogsIndex(refs.variantIds, refs.skus)

    const items = orders.flatMap((order) =>
      sumOrderCogs(order, index).lines
        .filter((line) => line.sku || line.variantId)
        .map((line) => ({
          orderNumber: Number(order.orderNumber || 0),
          sku: line.sku,
          variantId: line.variantId,
          name: line.name,
          quantity: line.quantity,
          unitCost: line.unitCost,
          lineCost: line.lineCost,
          productTitle: line.productTitle,
          variantTitle: line.variantTitle,
          costSource: line.source,
          // Party pack contents, so a $0-recipe pack can be seen to be costed.
          children: line.children ?? null,
        }))
    )

    items.sort((a, b) => b.lineCost - a.lineCost)

    const uncostedQty = items.reduce((s, it) => (it.unitCost > 0 ? s : s + it.quantity), 0)
    const totalQty = items.reduce((s, it) => s + it.quantity, 0)

    return NextResponse.json({
      period,
      start: startStr,
      end: endStr,
      basis: 'deliveryDate',
      items,
      totals: {
        items: items.length,
        totalCost: round2(items.reduce((s, it) => s + it.lineCost, 0)),
        uncostedQty,
        coveragePct: totalQty > 0 ? Math.round(((totalQty - uncostedQty) / totalQty) * 100) : 100,
      },
    })
  } catch (e) {
    console.error('❌ Cost breakdown error:', e)
    return NextResponse.json({ error: 'Failed to load cost breakdown' }, { status: 500 })
  }
}
