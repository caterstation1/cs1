import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapOrderToDayPriorEmailView } from '@/lib/day-prior-notification-service'
import { createOptOutToken } from '@/lib/order-notification-optout'
import {
  getAppUrl,
  getFulfillmentConfirmationHeaderUrl,
  getOptOutUrl,
  renderFulfillmentConfirmationEmail,
} from '@/lib/order-notification-email'
import { ensureFulfillmentCommsSettings, parseFulfillmentDefaultBodyCopy } from '@/lib/fulfillment-comms-service'

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId') || ''

    let order = null as Awaited<ReturnType<typeof prisma.order.findFirst>>
    if (orderId) {
      order = await prisma.order.findUnique({ where: { id: orderId } })
    } else {
      order = await prisma.order.findFirst({
        where: { cancelledAt: null },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!order) {
      return new NextResponse('<h1>No eligible order found for preview.</h1>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    const settings = await ensureFulfillmentCommsSettings()
    const email = (order.customerEmail || 'preview@example.com').trim().toLowerCase()
    const token = createOptOutToken(email || 'preview@example.com')
    const appUrl = getAppUrl()
    const html = renderFulfillmentConfirmationEmail({
      order: mapOrderToDayPriorEmailView(order),
      optOutUrl: getOptOutUrl(token, appUrl),
      headerImageUrl: getFulfillmentConfirmationHeaderUrl(appUrl),
      copy: { bodyParagraphs: parseFulfillmentDefaultBodyCopy(settings.defaultBodyCopy) },
      clientConfirmationNote: order.fulfillmentClientNote,
    })

    return new NextResponse(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error generating fulfillment preview:', error)
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500 })
  }
}
