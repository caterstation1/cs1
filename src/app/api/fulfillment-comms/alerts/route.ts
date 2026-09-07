import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'
import { getNZNowParts } from '@/lib/day-prior-notification-service'
import {
  ensureFulfillmentCommsSettings,
  normalizeTriggerRules,
} from '@/lib/fulfillment-comms-service'
import { evaluateTriggersForOrder } from '@/lib/fulfillment-comms-triggers'

function toLite(order: {
  id: string
  orderNumber: number
  createdAt: Date
  customerEmail: string
  customerFirstName: string
  customerLastName: string
  deliveryDate?: string | null
  deliveryTime?: string | null
  fulfillmentStatus?: string | null
  fulfillmentClientNote?: string | null
  lineItems: unknown
  shippingAddress: unknown
  totalPrice: number
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    customerEmail: order.customerEmail,
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
    deliveryDate: order.deliveryDate,
    deliveryTime: order.deliveryTime,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentClientNote: order.fulfillmentClientNote,
    lineItems: order.lineItems,
    shippingAddress: order.shippingAddress,
    totalPrice: order.totalPrice,
  }
}

export async function GET() {
  try {
    const settings = await ensureFulfillmentCommsSettings()
    const rules = normalizeTriggerRules(settings.triggerRules)
    const windowDays = Math.max(1, Math.min(90, settings.recentWindowDays || 7))

    const since = new Date()
    since.setDate(since.getDate() - windowDays)
    since.setHours(0, 0, 0, 0)

    const { nowYmd } = getNZNowParts()
    const todayStart = parseLocalDate(nowYmd) || new Date(nowYmd)
    const dayEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1)

    const recentOrders = await prisma.order.findMany({
      where: {
        cancelledAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const outTodayOrders = await prisma.order.findMany({
      where: {
        cancelledAt: null,
        deliveryDateResolved: {
          gte: todayStart,
          lt: dayEnd,
        },
      },
      orderBy: { deliveryTime: 'asc' },
      take: 500,
    })

    const unionIds = new Set<string>()
    const union: typeof recentOrders = []
    for (const o of recentOrders) {
      unionIds.add(o.id)
      union.push(o)
    }
    for (const o of outTodayOrders) {
      if (!unionIds.has(o.id)) {
        unionIds.add(o.id)
        union.push(o)
      }
    }

    const rawEmails = Array.from(
      new Set(union.map((o) => String(o.customerEmail || '').trim()).filter(Boolean))
    )

    const allForEmails =
      rawEmails.length === 0
        ? []
        : await prisma.order.findMany({
            where: {
              cancelledAt: null,
              customerEmail: { in: rawEmails },
            },
          })

    const byEmail = new Map<string, typeof allForEmails>()
    for (const o of allForEmails) {
      const k = String(o.customerEmail || '')
        .trim()
        .toLowerCase()
      if (!byEmail.has(k)) byEmail.set(k, [])
      byEmail.get(k)!.push(o)
    }

    const enrich = (orders: typeof recentOrders) =>
      orders.map((order) => {
        const k = String(order.customerEmail || '')
          .trim()
          .toLowerCase()
        const rows = byEmail.get(k) || []
        const matched = evaluateTriggersForOrder(
          {
            id: order.id,
            customerEmail: order.customerEmail,
            createdAt: order.createdAt,
            totalPrice: order.totalPrice,
            cancelledAt: order.cancelledAt,
          },
          rows.map((r) => ({
            id: r.id,
            customerEmail: r.customerEmail,
            createdAt: r.createdAt,
            totalPrice: r.totalPrice,
            cancelledAt: r.cancelledAt,
          })),
          rules
        )
        return {
          ...toLite(order),
          triggers: matched,
          lifetimeSpend: rows.filter((r) => !r.cancelledAt).reduce((s, r) => s + (r.totalPrice || 0), 0),
          orderOrdinal:
            rows
              .filter((r) => !r.cancelledAt)
              .filter((r) => r.createdAt.getTime() <= order.createdAt.getTime()).length,
        }
      })

    return NextResponse.json({
      recentWindowDays: windowDays,
      nowYmd,
      recentOrders: enrich(recentOrders),
      outTodayOrders: enrich(outTodayOrders),
      triggerRules: rules,
    })
  } catch (error) {
    console.error('fulfillment-comms/alerts', error)
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 })
  }
}
