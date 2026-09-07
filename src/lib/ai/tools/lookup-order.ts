import { prisma } from '@/lib/prisma'
import { ToolResult } from '../schemas'
import { resolveOrderDeliveryYmd } from '@/lib/labels/resolve-order'

export async function toolLookupOrder(orderNumber: number, includePII: boolean): Promise<ToolResult> {
  const order = await prisma.order.findFirst({
    where: { orderNumber: Number(orderNumber) },
    select: {
      id: true,
      orderNumber: true,
      deliveryTime: true,
      deliveryDate: true,
      deliveryDateTime: true,
      deliveryDateResolved: true,
      pickupDate: true,
      pickupTime: true,
      financialStatus: true,
      fulfillmentStatus: true,
      region: true,
      customerFirstName: true,
      customerLastName: true,
      customerEmail: true,
      customerPhone: true,
      isDispatched: true,
      driverId: true,
      internalNote: true,
      tags: true,
    },
  })

  if (!order) {
    return { answer: `Order ${orderNumber} not found.`, confidence: 0.2 }
  }

  const deliveryDay = resolveOrderDeliveryYmd(order)
  const customerName = [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ')
  const timePart = order.deliveryTime || order.pickupTime || 'not set'

  const answerParts = [
    `**Order #${order.orderNumber}**`,
    customerName ? `Customer: ${customerName}` : null,
    deliveryDay ? `Delivery: ${deliveryDay} · ${timePart}` : `Time: ${timePart}`,
    order.region ? `Region: ${order.region}` : null,
    `Status: ${order.financialStatus}${order.fulfillmentStatus ? ` / ${order.fulfillmentStatus}` : ''}`,
    order.isDispatched ? 'Dispatched' : null,
    includePII && order.customerPhone ? `Phone: ${order.customerPhone}` : null,
    includePII && order.customerEmail ? `Email: ${order.customerEmail}` : null,
  ].filter(Boolean)

  const row: Record<string, unknown> = {
    orderNumber: order.orderNumber,
    customer: customerName,
    deliveryDate: deliveryDay,
    deliveryTime: order.deliveryTime,
    region: order.region,
    status: `${order.financialStatus} / ${order.fulfillmentStatus || '—'}`,
  }
  if (includePII) {
    row.phone = order.customerPhone
    row.email = order.customerEmail
  }

  return {
    answer: answerParts.join('\n'),
    confidence: 0.9,
    evidence: {
      tables: [{ name: 'Order', rows: [row] }],
      links: [{ label: `Open order #${order.orderNumber}`, href: `/orders?search=${order.orderNumber}` }],
    },
    actions: [{
      type: 'open_url',
      label: `Open order #${order.orderNumber}`,
      href: `/orders?search=${order.orderNumber}`,
    }],
  }
}
