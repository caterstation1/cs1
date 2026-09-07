import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildTransporter, mapOrderToDayPriorEmailView } from '@/lib/day-prior-notification-service'
import { createOptOutToken } from '@/lib/order-notification-optout'
import {
  getAppUrl,
  getFulfillmentConfirmationHeaderUrl,
  getOptOutUrl,
  renderFulfillmentConfirmationEmail,
} from '@/lib/order-notification-email'
import {
  ensureFulfillmentCommsSettings,
  parseFulfillmentDefaultBodyCopy,
  resolveFulfillmentSenderProfile,
} from '@/lib/fulfillment-comms-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const settings = await ensureFulfillmentCommsSettings()
    const sender = resolveFulfillmentSenderProfile(settings)
    const to = String(body.to || settings.testRecipientEmail || '').trim()

    if (!to) {
      return NextResponse.json({ error: 'Missing recipient email. Set test recipient first.' }, { status: 400 })
    }

    const requestedOrderId = String(body.orderId || '').trim()
    let order = null as Awaited<ReturnType<typeof prisma.order.findFirst>>
    if (requestedOrderId) {
      order = await prisma.order.findUnique({ where: { id: requestedOrderId } })
    } else {
      order = await prisma.order.findFirst({
        where: { cancelledAt: null },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!order) {
      return NextResponse.json({ error: 'No eligible order found for test send.' }, { status: 404 })
    }

    const noteOverride =
      typeof body.fulfillmentClientNote === 'string' ? body.fulfillmentClientNote : undefined
    const clientNote = noteOverride !== undefined ? noteOverride : order.fulfillmentClientNote

    const appUrl = getAppUrl()
    const optOutToken = createOptOutToken(to.toLowerCase())
    const html = renderFulfillmentConfirmationEmail({
      order: mapOrderToDayPriorEmailView(order),
      optOutUrl: getOptOutUrl(optOutToken, appUrl),
      headerImageUrl: getFulfillmentConfirmationHeaderUrl(appUrl),
      copy: { bodyParagraphs: parseFulfillmentDefaultBodyCopy(settings.defaultBodyCopy) },
      clientConfirmationNote: clientNote,
    })

    const subjectBase =
      String(settings.emailSubject || '').trim() || `Your Cater Station order #${order.orderNumber} is fulfilled`

    const transporter = buildTransporter()
    await transporter.sendMail({
      from: `"${sender.fromName}" <${sender.fromEmail}>`,
      to,
      replyTo: sender.replyTo,
      subject: `[TEST] ${subjectBase}`,
      html,
    })

    return NextResponse.json({
      success: true,
      to,
      orderId: order.id,
      orderNumber: order.orderNumber,
      sender,
    })
  } catch (error) {
    console.error('Error sending fulfillment comms test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
