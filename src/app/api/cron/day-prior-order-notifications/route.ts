import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildTransporter,
  getPickupInstructionAttachmentIfAny,
  getDayPriorOverrides,
  getDayPriorCopyForOrder,
  getDayPriorSettings,
  getHeaderImageForOrder,
  isPickupOrder,
  getNZNowParts,
  getTomorrowOrdersForDayPrior,
  mapOrderToDayPriorEmailView,
  resolveDayPriorRecipientEmail,
  resolveSenderProfile,
} from '@/lib/day-prior-notification-service'
import { createOptOutToken } from '@/lib/order-notification-optout'
import { getAppUrl, getOptOutUrl, renderDayPriorOrderEmail } from '@/lib/order-notification-email'

function inSendWindow(nowHour: number, nowMinute: number, targetHour: number, targetMinute: number) {
  return nowHour === targetHour && nowMinute >= targetMinute && nowMinute <= targetMinute + 9
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const force = request.nextUrl.searchParams.get('force') === '1'
    const onlyOrderId = request.nextUrl.searchParams.get('orderId')
    const settings = await getDayPriorSettings()

    if (!settings.enabled && !force) {
      return NextResponse.json({ message: 'Day-prior notifications disabled', sent: 0, skipped: 0 })
    }

    const { hour, minute, nowYmd } = getNZNowParts()
    if (!force && !inSendWindow(hour, minute, settings.sendHourNZ, settings.sendMinuteNZ)) {
      return NextResponse.json({
        message: 'Outside configured send window',
        now: { hour, minute, nowYmd },
        target: { hour: settings.sendHourNZ, minute: settings.sendMinuteNZ },
      })
    }

    const senderProfile = resolveSenderProfile(settings)
    const transporter = buildTransporter()
    const appUrl = getAppUrl()
    const { tomorrowYmd, orders } = await getTomorrowOrdersForDayPrior()
    const targetOrders = onlyOrderId ? orders.filter((o) => o.id === onlyOrderId) : orders
    const overrides = await getDayPriorOverrides(tomorrowYmd)
    const overrideByOrderId = new Map(overrides.map((o) => [o.orderId, o]))

    let sent = 0
    let skipped = 0
    const errors: Array<{ orderId: string; error: string }> = []

    for (const order of targetOrders) {
      const override = overrideByOrderId.get(order.id)
      if (override?.excluded && !force) {
        skipped++
        await prisma.orderNotificationSendLog.upsert({
          where: {
            orderId_notificationDate_notificationType: {
              orderId: order.id,
              notificationDate: new Date(tomorrowYmd),
              notificationType: 'day_prior',
            },
          },
          update: {
            recipientEmail: '',
            senderEmail: senderProfile.fromEmail,
            status: 'skipped_manual',
            errorMessage: override.reason || 'Manually removed from day-prior queue',
            sentAt: new Date(),
          },
          create: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
            recipientEmail: '',
            senderEmail: senderProfile.fromEmail,
            status: 'skipped_manual',
            errorMessage: override.reason || 'Manually removed from day-prior queue',
          },
        }).catch(() => {})
        continue
      }

      const recipientEmail = resolveDayPriorRecipientEmail({
        order,
        overrideRecipientEmail: override?.overrideRecipientEmail,
      })
      if (!recipientEmail) {
        skipped++
        await prisma.orderNotificationSendLog.create({
          data: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
            recipientEmail: '',
            senderEmail: senderProfile.fromEmail,
            status: 'skipped_missing_email',
            errorMessage: 'Order has no customerEmail',
          },
        }).catch(() => {})
        continue
      }

      const optedOut = await prisma.orderNotificationOptOut.findUnique({ where: { email: recipientEmail } })
      if (optedOut) {
        skipped++
        await prisma.orderNotificationSendLog.create({
          data: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
            recipientEmail,
            senderEmail: senderProfile.fromEmail,
            status: 'skipped_opt_out',
            errorMessage: 'Recipient opted out',
          },
        }).catch(() => {})
        continue
      }

      const alreadySent = await prisma.orderNotificationSendLog.findUnique({
        where: {
          orderId_notificationDate_notificationType: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
          },
        },
      })

      if (alreadySent && !force) {
        skipped++
        continue
      }

      try {
        const optOutToken = createOptOutToken(recipientEmail)
        const optOutUrl = getOptOutUrl(optOutToken, appUrl)
        const emailOrder = mapOrderToDayPriorEmailView(order)
        const html = renderDayPriorOrderEmail({
          order: emailOrder,
          optOutUrl,
          headerImageUrl: getHeaderImageForOrder(order, appUrl),
          copy: getDayPriorCopyForOrder(settings, order),
        })
        const pickupAttachment = isPickupOrder(order) ? await getPickupInstructionAttachmentIfAny() : null

        await transporter.sendMail({
          from: `"${senderProfile.fromName}" <${senderProfile.fromEmail}>`,
          to: recipientEmail,
          replyTo: senderProfile.replyTo,
          subject: `We're getting ready for your order tomorrow!`,
          html,
          attachments: pickupAttachment ? [pickupAttachment] : [],
        })

        sent++
        await prisma.orderNotificationSendLog.upsert({
          where: {
            orderId_notificationDate_notificationType: {
              orderId: order.id,
              notificationDate: new Date(tomorrowYmd),
              notificationType: 'day_prior',
            },
          },
          update: {
            recipientEmail,
            senderEmail: senderProfile.fromEmail,
            status: 'sent',
            errorMessage: null,
            sentAt: new Date(),
          },
          create: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
            recipientEmail,
            senderEmail: senderProfile.fromEmail,
            status: 'sent',
          },
        })
      } catch (error) {
        skipped++
        const message = error instanceof Error ? error.message : 'Unknown send error'
        errors.push({ orderId: order.id, error: message })
        await prisma.orderNotificationSendLog.upsert({
          where: {
            orderId_notificationDate_notificationType: {
              orderId: order.id,
              notificationDate: new Date(tomorrowYmd),
              notificationType: 'day_prior',
            },
          },
          update: {
            recipientEmail,
            senderEmail: senderProfile.fromEmail,
            status: 'failed',
            errorMessage: message,
            sentAt: new Date(),
          },
          create: {
            orderId: order.id,
            notificationDate: new Date(tomorrowYmd),
            notificationType: 'day_prior',
            recipientEmail,
            senderEmail: senderProfile.fromEmail,
            status: 'failed',
            errorMessage: message,
          },
        })
      }
    }

    return NextResponse.json({
      message: 'Day-prior notification run complete',
      tomorrowYmd,
      processed: targetOrders.length,
      sent,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Error in day-prior notification cron:', error)
    return NextResponse.json(
      { error: 'Failed to run day-prior notifications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
