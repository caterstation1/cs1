import { prisma } from '@/lib/prisma'
import { formatNZYMD, getTodayLocal } from '@/lib/date-utils'
import { ToolResult } from '../schemas'

const MAX_ORDERS = 10

export async function toolOrdersForDay(args: {
  date?: string
  region?: string
}): Promise<ToolResult> {
  let dateYmd = args.date?.trim()
  if (!dateYmd || dateYmd === 'today') {
    dateYmd = formatNZYMD(getTodayLocal())
  } else if (dateYmd === 'tomorrow') {
    const t = getTodayLocal()
    t.setDate(t.getDate() + 1)
    dateYmd = formatNZYMD(t)
  } else if (dateYmd === 'yesterday') {
    const t = getTodayLocal()
    t.setDate(t.getDate() - 1)
    dateYmd = formatNZYMD(t)
  }

  const region = args.region?.toUpperCase()
  const where: Record<string, unknown> = {
    deliveryDate: dateYmd,
    cancelledAt: null,
  }
  if (region === 'AKL' || region === 'WLG') {
    where.region = region
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        orderNumber: true,
        deliveryTime: true,
        customerFirstName: true,
        customerLastName: true,
        region: true,
        isDispatched: true,
        totalPrice: true,
      },
      orderBy: { deliveryTime: 'asc' },
      take: MAX_ORDERS,
    }),
    prisma.order.count({ where }),
  ])

  const regionLabel = region ? ` (${region})` : ''
  if (total === 0) {
    return {
      answer: `No deliveries scheduled for ${dateYmd}${regionLabel}.`,
      confidence: 0.85,
      evidence: { totals: { orderCount: 0, date: dateYmd } },
    }
  }

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    time: o.deliveryTime || '—',
    customer: [o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') || '—',
    region: o.region,
    dispatched: o.isDispatched ? 'yes' : 'no',
    total: o.totalPrice != null ? `$${Number(o.totalPrice).toFixed(2)}` : '—',
  }))

  const more = total > MAX_ORDERS ? ` Showing first ${MAX_ORDERS}.` : ''
  return {
    answer: `${total} deliver${total === 1 ? 'y' : 'ies'} scheduled for ${dateYmd}${regionLabel}.${more}`,
    confidence: 0.88,
    evidence: {
      totals: { orderCount: total, date: dateYmd, region: region || 'all' },
      tables: [{ name: `Deliveries ${dateYmd}`, rows }],
      links: [{ label: 'Open calendar', href: '/calendar' }],
    },
  }
}
