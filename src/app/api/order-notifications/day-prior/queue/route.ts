import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import {
  getDayPriorOverrides,
  getTomorrowOrdersForDayPrior,
  resolveDayPriorRecipientEmail,
} from '@/lib/day-prior-notification-service'
import { formatShippingAddressText } from '@/lib/order-notification-email'

function normalizeEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase()
  return email || null
}

export async function GET(request: NextRequest) {
  try {
    const baseYmd = request.nextUrl.searchParams.get('date') || formatNZYMD(new Date())
    const notificationDateYmd = addDaysNZ(baseYmd, 1)
    const { orders } = await getTomorrowOrdersForDayPrior(undefined, baseYmd)
    const overrides = await getDayPriorOverrides(notificationDateYmd)
    const overrideByOrderId = new Map(overrides.map((o) => [o.orderId, o]))

    const sendLogs = await prisma.orderNotificationSendLog.findMany({
      where: {
        notificationType: 'day_prior',
        notificationDate: new Date(notificationDateYmd),
      },
    })
    const logByOrderId = new Map(sendLogs.map((l) => [l.orderId, l]))

    const effectiveEmails = orders.map((order) => {
      const override = overrideByOrderId.get(order.id)
      return resolveDayPriorRecipientEmail({
        order,
        overrideRecipientEmail: override?.overrideRecipientEmail,
      })
    }).filter(Boolean)
    const optedOutRows = await prisma.orderNotificationOptOut.findMany({
      where: { email: { in: effectiveEmails } },
    })
    const optedOutSet = new Set(optedOutRows.map((r) => r.email))

    const queue = orders.map((order) => {
        const override = overrideByOrderId.get(order.id)
        const effectiveRecipientEmail = resolveDayPriorRecipientEmail({
          order,
          overrideRecipientEmail: override?.overrideRecipientEmail,
        })
        const sendLog = logByOrderId.get(order.id) || null
        const optedOut = effectiveRecipientEmail ? optedOutSet.has(effectiveRecipientEmail) : false

        let queueStatus:
          | 'ready'
          | 'excluded'
          | 'missing_email'
          | 'opted_out'
          | 'already_processed' = 'ready'
        if (override?.excluded) queueStatus = 'excluded'
        else if (!effectiveRecipientEmail) queueStatus = 'missing_email'
        else if (optedOut) queueStatus = 'opted_out'
        else if (sendLog) queueStatus = 'already_processed'

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Customer',
          deliveryTime: order.deliveryTime || '',
          shippingAddressText: formatShippingAddressText(order.shippingAddress),
          hasLocalEdits: Boolean(order.hasLocalEdits),
          updatedAt: order.dbUpdatedAt || order.updatedAt,
          sourceRecipientEmail: normalizeEmail(order.customerEmail),
          overrideRecipientEmail: normalizeEmail(override?.overrideRecipientEmail),
          effectiveRecipientEmail: normalizeEmail(effectiveRecipientEmail),
          excluded: Boolean(override?.excluded),
          overrideReason: override?.reason || null,
          queueStatus,
          sendLog: sendLog
            ? {
                status: sendLog.status,
                sentAt: sendLog.sentAt,
                errorMessage: sendLog.errorMessage,
              }
            : null,
        }
      })

    return NextResponse.json({
      baseDateYmd: baseYmd,
      notificationDateYmd,
      count: queue.length,
      queue,
    })
  } catch (error) {
    console.error('Error loading day-prior queue:', error)
    return NextResponse.json(
      { error: 'Failed to load day-prior queue' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const orderId = String(body.orderId || '').trim()
    const notificationDateYmd = String(body.notificationDateYmd || '').trim()
    if (!orderId || !notificationDateYmd) {
      return NextResponse.json(
        { error: 'orderId and notificationDateYmd are required' },
        { status: 400 }
      )
    }

    const overrideRecipientEmail = body.overrideRecipientEmail === ''
      ? null
      : normalizeEmail(body.overrideRecipientEmail)
    const excluded = Boolean(body.excluded)
    const reason = String(body.reason || '').trim() || null

    const record = await prisma.dayPriorOrderOverride.upsert({
      where: {
        orderId_notificationDate: {
          orderId,
          notificationDate: new Date(notificationDateYmd),
        },
      },
      update: {
        overrideRecipientEmail,
        excluded,
        reason,
      },
      create: {
        orderId,
        notificationDate: new Date(notificationDateYmd),
        overrideRecipientEmail,
        excluded,
        reason,
      },
    })

    return NextResponse.json({ success: true, record })
  } catch (error) {
    console.error('Error updating day-prior queue override:', error)
    return NextResponse.json(
      { error: 'Failed to update queue override' },
      { status: 500 }
    )
  }
}
