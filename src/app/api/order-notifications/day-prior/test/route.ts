import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import {
  buildTransporter,
  getPickupInstructionAttachmentIfAny,
  getDayPriorCopyForOrder,
  getDayPriorSettings,
  getHeaderImageForOrder,
  isPickupOrder,
  getOrderRegion,
  mapOrderToDayPriorEmailView,
  resolveSenderProfile,
} from '@/lib/day-prior-notification-service'
import { isWellingtonOrder } from '@/lib/region'
import { createOptOutToken } from '@/lib/order-notification-optout'
import { getAppUrl, getOptOutUrl, renderDayPriorOrderEmail } from '@/lib/order-notification-email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const settings = await getDayPriorSettings()
    const senderProfile = resolveSenderProfile(settings)
    const to = String(body.to || settings.testRecipientEmail || '').trim()

    if (!to) {
      return NextResponse.json({ error: 'Missing recipient email. Set test recipient first.' }, { status: 400 })
    }

    const requestedOrderId = String(body.orderId || '').trim()
    const region = String(body.region || '').toLowerCase()
    const baseYmd = formatNZYMD(new Date())
    const tomorrowYmd = addDaysNZ(baseYmd, 1)
  const dayAfterYmd = addDaysNZ(tomorrowYmd, 1)
  const tomorrowStartUtc = new Date(`${tomorrowYmd}T00:00:00.000Z`)
  const dayAfterStartUtc = new Date(`${dayAfterYmd}T00:00:00.000Z`)

    let order: any = null
    if (requestedOrderId) {
      order = await prisma.order.findUnique({ where: { id: requestedOrderId } })
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
      return NextResponse.json({ error: 'No eligible order found for test send.' }, { status: 404 })
    }

    const optOutToken = createOptOutToken(to.toLowerCase())
    const html = renderDayPriorOrderEmail({
      order: mapOrderToDayPriorEmailView(order),
      optOutUrl: getOptOutUrl(optOutToken, getAppUrl()),
      headerImageUrl: getHeaderImageForOrder(order, getAppUrl()),
      copy: getDayPriorCopyForOrder(settings, order),
    })
    const pickupAttachment = isPickupOrder(order) ? await getPickupInstructionAttachmentIfAny() : null

    const transporter = buildTransporter()
    await transporter.sendMail({
      from: `"${senderProfile.fromName}" <${senderProfile.fromEmail}>`,
      to,
      replyTo: senderProfile.replyTo,
      subject: `[TEST] We're getting ready for your order tomorrow!`,
      html,
      attachments: pickupAttachment ? [pickupAttachment] : [],
    })

    return NextResponse.json({
      success: true,
      to,
      orderId: order.id,
      orderNumber: order.orderNumber,
      region: getOrderRegion(order),
      sender: senderProfile,
    })
  } catch (error) {
    console.error('Error sending day-prior test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
