import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate, createLocalDate } from '@/lib/date-utils'

function getPeriodRange(period: string): { startStr: string; endStr: string } {
  const today = getTodayLocal()
  const todayStr = formatLocalDate(today)
  if (period === 'today') return { startStr: todayStr, endStr: todayStr }
  if (period === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    const ys = formatLocalDate(y)
    return { startStr: ys, endStr: ys }
  }
  if (period === 'week') {
    const startOfWeek = new Date(today)
    const dow = today.getDay()
    const daysToMonday = dow === 0 ? 6 : dow - 1
    startOfWeek.setDate(today.getDate() - daysToMonday)
    return { startStr: formatLocalDate(startOfWeek), endStr: todayStr }
  }
  if (period === 'month') {
    const som = createLocalDate(today.getFullYear(), today.getMonth() + 1, 1)
    return { startStr: formatLocalDate(som), endStr: todayStr }
  }
  if (period === 'year') {
    const soy = createLocalDate(today.getFullYear(), 1, 1)
    return { startStr: formatLocalDate(soy), endStr: todayStr }
  }
  return { startStr: todayStr, endStr: todayStr }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') || 'today').toLowerCase()
    const { startStr, endStr } = getPeriodRange(period)

    const orders = await prisma.order.findMany({
      where: {
        AND: [
          { deliveryDate: { gte: startStr } },
          { deliveryDate: { lte: endStr } }
        ]
      },
      select: {
        orderNumber: true,
        deliveryDate: true,
        deliveryTime: true,
        totalPrice: true,
        subtotalPrice: true,
        totalTax: true,
        shippingAddress: true,
      },
      orderBy: [
        { deliveryDate: 'asc' },
        { deliveryTime: 'asc' },
        { orderNumber: 'asc' }
      ]
    })

    const rows = orders.map(o => {
      const tot = Number(o.totalPrice)
      const sub = Number(o.subtotalPrice)
      const tax = Number(o.totalTax)
      const incGstRaw = isFinite(tot) ? tot : (isFinite(sub) && isFinite(tax) ? (sub + tax) : 0)
      const salesIncGst = Number(incGstRaw.toFixed(2))
      const salesExGst = Number((incGstRaw / 1.15).toFixed(2))
      const gst = Number((salesIncGst - salesExGst).toFixed(2))
      return {
        orderNumber: o.orderNumber,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime || null,
        salesExGst,
        gst,
        salesIncGst,
        address: o.shippingAddress || null
      }
    })

    return NextResponse.json({ period, start: startStr, end: endStr, orders: rows })
  } catch (e) {
    console.error('❌ orders list error:', e)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}

