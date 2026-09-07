import { prisma } from '@/lib/prisma'
import { buildTransporter, getNZNowParts, mapOrderToDayPriorEmailView } from '@/lib/day-prior-notification-service'
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
function getNzTodayDate(): Date {
  const { nowYmd } = getNZNowParts()
  return new Date(`${nowYmd}T00:00:00.000Z`)
}

export async function sendFulfillmentConfirmationForOrder(orderId: string): Promise<{
  ok: boolean
  reason?: string
}> {
  const settings = await ensureFulfillmentCommsSettings()
  if (!settings.enabled) {
    return { ok: false, reason: 'fulfillment_comms_disabled' }
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, reason: 'order_not_found' }

  const notificationDate = getNzTodayDate()
  const existing = await prisma.orderNotificationSendLog.findUnique({
    where: {
      orderId_notificationDate_notificationType: {
        orderId: order.id,
        notificationDate,
        notificationType: 'fulfillment_confirmation',
      },
    },
  })
  if (existing?.status === 'sent') {
    return { ok: false, reason: 'already_sent_today' }
  }

  const recipientRaw = String(order.customerEmail || '')
    .trim()
    .toLowerCase()
  if (!recipientRaw) {
    await prisma.orderNotificationSendLog.upsert({
      where: {
        orderId_notificationDate_notificationType: {
          orderId: order.id,
          notificationDate,
          notificationType: 'fulfillment_confirmation',
        },
      },
      update: {
        recipientEmail: '',
        status: 'skipped_missing_email',
        errorMessage: 'No customer email on order',
        sentAt: new Date(),
      },
      create: {
        orderId: order.id,
        notificationDate,
        notificationType: 'fulfillment_confirmation',
        recipientEmail: '',
        status: 'skipped_missing_email',
        errorMessage: 'No customer email on order',
      },
    })
    return { ok: false, reason: 'missing_email' }
  }

  const optedOut = await prisma.orderNotificationOptOut.findUnique({
    where: { email: recipientRaw },
  })
  if (optedOut) {
    await prisma.orderNotificationSendLog.upsert({
      where: {
        orderId_notificationDate_notificationType: {
          orderId: order.id,
          notificationDate,
          notificationType: 'fulfillment_confirmation',
        },
      },
      update: {
        recipientEmail: recipientRaw,
        status: 'skipped_opt_out',
        errorMessage: null,
        sentAt: new Date(),
      },
      create: {
        orderId: order.id,
        notificationDate,
        notificationType: 'fulfillment_confirmation',
        recipientEmail: recipientRaw,
        status: 'skipped_opt_out',
      },
    })
    return { ok: false, reason: 'opted_out' }
  }

  const liveMode = Boolean(settings.liveMode)
  const testTo = String(settings.testRecipientEmail || '')
    .trim()
    .toLowerCase()
  const to = liveMode ? recipientRaw : testTo
  if (!to) {
    await prisma.orderNotificationSendLog.upsert({
      where: {
        orderId_notificationDate_notificationType: {
          orderId: order.id,
          notificationDate,
          notificationType: 'fulfillment_confirmation',
        },
      },
      update: {
        recipientEmail: recipientRaw,
        status: 'failed',
        errorMessage: liveMode ? 'No recipient' : 'liveMode off but testRecipientEmail empty',
        sentAt: new Date(),
      },
      create: {
        orderId: order.id,
        notificationDate,
        notificationType: 'fulfillment_confirmation',
        recipientEmail: recipientRaw,
        status: 'failed',
        errorMessage: liveMode ? 'No recipient' : 'liveMode off but testRecipientEmail empty',
      },
    })
    return { ok: false, reason: 'no_test_recipient' }
  }

  const sender = resolveFulfillmentSenderProfile(settings)
  const appUrl = getAppUrl()
  const headerImageUrl = getFulfillmentConfirmationHeaderUrl(appUrl)
  const optOutEmail = liveMode ? recipientRaw : testTo
  const optOutToken = createOptOutToken(optOutEmail)
  const optOutUrl = getOptOutUrl(optOutToken, appUrl)
  const bodyParagraphs = parseFulfillmentDefaultBodyCopy(settings.defaultBodyCopy)

  const html = renderFulfillmentConfirmationEmail({
    order: mapOrderToDayPriorEmailView(order),
    optOutUrl,
    headerImageUrl,
    copy: { bodyParagraphs },
    clientConfirmationNote: order.fulfillmentClientNote,
  })

  const subjectBase =
    String(settings.emailSubject || '').trim() || `Your Cater Station order #${order.orderNumber} is fulfilled`
  const subject = liveMode ? subjectBase : `[TEST] ${subjectBase}`

  const transporter = buildTransporter()
  await transporter.sendMail({
    from: `"${sender.fromName}" <${sender.fromEmail}>`,
    to,
    replyTo: sender.replyTo,
    subject,
    html,
  })

  await prisma.orderNotificationSendLog.upsert({
    where: {
      orderId_notificationDate_notificationType: {
        orderId: order.id,
        notificationDate,
        notificationType: 'fulfillment_confirmation',
      },
    },
    update: {
      recipientEmail: to,
      senderEmail: sender.fromEmail,
      status: 'sent',
      errorMessage: liveMode ? null : 'liveMode_off_sent_to_test',
      sentAt: new Date(),
    },
    create: {
      orderId: order.id,
      notificationDate,
      notificationType: 'fulfillment_confirmation',
      recipientEmail: to,
      senderEmail: sender.fromEmail,
      status: 'sent',
      errorMessage: liveMode ? null : 'liveMode_off_sent_to_test',
    },
  })

  return { ok: true }
}
