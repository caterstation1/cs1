import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import { getDayPriorCopyForOrder, getDayPriorSettings, getHeaderImageForOrder, mapOrderToDayPriorEmailView } from '@/lib/day-prior-notification-service'
import { createOptOutToken } from '@/lib/order-notification-optout'
import { getAppUrl, getOptOutUrl, renderDayPriorOrderEmail } from '@/lib/order-notification-email'
import { isWellingtonOrder } from '@/lib/region'

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId') || ''
    const region = (request.nextUrl.searchParams.get('region') || '').toLowerCase()
    const baseYmd = request.nextUrl.searchParams.get('date') || formatNZYMD(new Date())
    const tomorrowYmd = addDaysNZ(baseYmd, 1)
    const dayAfterYmd = addDaysNZ(tomorrowYmd, 1)
    const tomorrowStartUtc = new Date(`${tomorrowYmd}T00:00:00.000Z`)
    const dayAfterStartUtc = new Date(`${dayAfterYmd}T00:00:00.000Z`)

    let order: any = null
    if (orderId) {
      order = await prisma.order.findUnique({ where: { id: orderId } })
    } else {
      const orders = await prisma.order.findMany({
        where: {
          deliveryDateResolved: { gte: tomorrowStartUtc, lt: dayAfterStartUtc },
          cancelledAt: null,
        },
        orderBy: { deliveryTime: 'asc' },
      })
      const filtered =
        region === 'wlg'
          ? orders.filter(isWellingtonOrder)
          : region === 'auckland'
            ? orders.filter((o) => !isWellingtonOrder(o))
            : orders
      order = filtered[0] || null
    }

    if (!order) {
      return new NextResponse('<h1>No eligible order found for preview.</h1>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    const email = (order.customerEmail || 'preview@example.com').trim().toLowerCase()
    const token = createOptOutToken(email || 'preview@example.com')
    const settings = await getDayPriorSettings()
    const html = renderDayPriorOrderEmail({
      order: mapOrderToDayPriorEmailView(order),
      optOutUrl: getOptOutUrl(token, getAppUrl()),
      headerImageUrl: getHeaderImageForOrder(order, getAppUrl()),
      copy: getDayPriorCopyForOrder(settings, order),
    })

    return new NextResponse(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error generating day-prior preview:', error)
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500 })
  }
}
