import { prisma } from '@/lib/prisma'
import { ToolResult, AllergenKey } from '../schemas'
import { resolveProductAllergen } from '../allergens'
import { buildLabelPrintUrl, resolveOrderDeliveryYmd } from '@/lib/labels/resolve-order'
import { createPendingOrderUpdate } from '../pending-actions'

const ORDER_PATCH_FIELDS = ['deliveryTime', 'deliveryDate', 'internalNote'] as const
export type OrderPatchField = (typeof ORDER_PATCH_FIELDS)[number]

const FIELD_LABELS: Record<OrderPatchField, string> = {
  deliveryTime: 'Delivery time',
  deliveryDate: 'Delivery date',
  internalNote: 'Internal note',
}

function formatValue(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

export async function toolCheckAllergen(menuName: string, allergen: AllergenKey): Promise<ToolResult> {
  const { matches, variants } = await resolveProductAllergen(menuName, allergen)
  const containing = matches.filter((m) => m.contains)

  if (matches.length === 0) {
    return {
      answer: `No menu item matching "${menuName}" found. Try a shorter product name.`,
      confidence: 0.3,
    }
  }

  if (containing.length === 0) {
    return {
      answer: `No ${allergen} flagged for "${menuName}" in matching products/components.`,
      confidence: 0.8,
      evidence: { tables: [{ name: 'Matches checked', rows: matches.slice(0, 10) }] },
    }
  }

  const best = containing[0]
  const sourceText = best.sources.length ? ` (via ${best.sources.join(', ')})` : ''
  return {
    answer: `Yes — **${best.name}** contains **${allergen}**${sourceText}.`,
    confidence: 0.9,
    evidence: {
      tables: [
        { name: 'Allergen matches', rows: containing.slice(0, 10) },
        ...(variants.length ? [{ name: 'Product variants', rows: variants }] : []),
      ],
    },
  }
}

export async function toolPrintLabels(orderNumber: number): Promise<ToolResult> {
  const order = await prisma.order.findFirst({
    where: { orderNumber, cancelledAt: null },
    select: {
      orderNumber: true,
      deliveryDateResolved: true,
      deliveryDateTime: true,
      deliveryDate: true,
      pickupDate: true,
      customerFirstName: true,
      customerLastName: true,
    },
  })

  if (!order) return { answer: `Order ${orderNumber} not found.`, confidence: 0.2 }

  const date = resolveOrderDeliveryYmd(order)
  if (!date) {
    return { answer: `Order ${orderNumber} has no delivery date — labels can't be generated yet.`, confidence: 0.4 }
  }

  const customerName = [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ')
  const href = buildLabelPrintUrl(orderNumber)

  return {
    answer: `Ready to print labels for **#${orderNumber}**${customerName ? ` (${customerName})` : ''} · delivery ${date}.`,
    confidence: 0.95,
    actions: [{ type: 'open_url', label: `Print labels for #${orderNumber}`, href }],
    evidence: { links: [{ label: `Print #${orderNumber}`, href }] },
  }
}

export async function toolProposeOrderUpdate(
  orderNumber: number,
  patch: Partial<Record<OrderPatchField, string>>,
  actorEmail?: string | null,
): Promise<ToolResult> {
  const cleanPatch: Record<string, string> = {}
  for (const key of ORDER_PATCH_FIELDS) {
    const val = patch[key]
    if (val != null && String(val).trim() !== '') cleanPatch[key] = String(val).trim()
  }

  if (Object.keys(cleanPatch).length === 0) {
    return {
      answer: 'No valid fields to update. Supported: delivery time, delivery date, internal note.',
      confidence: 0.2,
    }
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: Number(orderNumber) },
    select: {
      id: true,
      orderNumber: true,
      deliveryTime: true,
      deliveryDate: true,
      deliveryDateTime: true,
      deliveryDateResolved: true,
      customerFirstName: true,
      customerLastName: true,
      region: true,
      financialStatus: true,
      fulfillmentStatus: true,
      internalNote: true,
    },
  })

  if (!order) return { answer: `Order ${orderNumber} not found.`, confidence: 0.2 }

  const before: Record<string, unknown> = {}
  for (const key of Object.keys(cleanPatch)) {
    before[key] = (order as Record<string, unknown>)[key]
  }

  const changes = Object.keys(cleanPatch).map((field) => {
    const f = field as OrderPatchField
    return {
      field,
      label: FIELD_LABELS[f] || field,
      before: formatValue(before[field]),
      after: formatValue(cleanPatch[field]),
    }
  })

  const confirmToken = createPendingOrderUpdate({
    orderId: order.id,
    orderNumber: order.orderNumber,
    patch: cleanPatch,
    before,
    actorEmail,
  })

  const customerName = [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ')
  const deliveryDay = resolveOrderDeliveryYmd(order)

  const proposal = {
    confirmToken,
    title: `Update order #${order.orderNumber}`,
    summary: `${changes.map((c) => `${c.label}: ${c.before ?? '—'} → ${c.after}`).join('; ')}`,
    orderNumber: order.orderNumber,
    orderContext: {
      customer: customerName || null,
      deliveryDate: deliveryDay,
      deliveryTime: order.deliveryTime,
      region: order.region,
      status: `${order.financialStatus}${order.fulfillmentStatus ? ` / ${order.fulfillmentStatus}` : ''}`,
    },
    changes,
    unchangedNote: 'All other order fields will remain unchanged.',
  }

  return {
    answer: `Review the proposed update for order **#${order.orderNumber}** before confirming.`,
    confidence: 0.95,
    proposal,
    actions: [{
      type: 'confirm',
      label: `Confirm update to order #${order.orderNumber}`,
      confirmToken,
    }],
    evidence: {
      links: [{ label: `Open order #${order.orderNumber}`, href: `/orders?search=${order.orderNumber}` }],
    },
  }
}
