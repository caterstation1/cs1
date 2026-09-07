import { prisma } from '@/lib/prisma'
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver'
import { canonicalizeOrderScheduling } from '@/lib/order-canonicalize'
import { buildOrderChangeEntries, writeOrderChangeLog } from '@/lib/order-change-log'
import { consumePendingAction } from './pending-actions'

type Actor = { id?: string | null; name?: string | null; email?: string | null }

export async function commitPendingOrderUpdate(
  confirmToken: string,
  actor?: Actor,
): Promise<{ ok: true; orderNumber: number } | { ok: false; error: string }> {
  const pending = consumePendingAction(confirmToken, actor?.email ?? undefined)
  if (!pending || pending.type !== 'order_update') {
    return { ok: false, error: 'This confirmation link expired or is invalid. Please ask again.' }
  }

  const existing = await prisma.order.findUnique({ where: { id: pending.orderId } })
  if (!existing) {
    return { ok: false, error: 'Order no longer exists.' }
  }

  const candidate = {
    deliveryDate: (pending.patch.deliveryDate as string | undefined) ?? existing.deliveryDate,
    noteAttributes: existing.noteAttributes,
    tags: existing.tags,
    createdAt: existing.createdAt,
  }
  const resolved = resolveDeliveryDateResolved(candidate)

  const updatedOrderData = {
    ...existing,
    ...pending.patch,
    shippingAddress: existing.shippingAddress,
    noteAttributes: existing.noteAttributes,
  }
  const scheduling = canonicalizeOrderScheduling(updatedOrderData as any)

  const updateData = {
    ...pending.patch,
    hasLocalEdits: true,
    deliveryDateResolved: resolved.date,
    deliveryDateResolvedSource: resolved.source,
    deliveryDateResolvedAt: new Date(),
    region: scheduling.region,
    deliveryDateTime: scheduling.deliveryDateTime,
    deliveryDateSource: scheduling.deliveryDateSource,
    needsSchedulingReview: scheduling.needsSchedulingReview,
  }

  const order = await prisma.order.update({
    where: { id: pending.orderId },
    data: updateData,
  })

  const candidateKeys = [
    ...Object.keys(pending.patch),
    'hasLocalEdits',
    'deliveryDateResolved',
    'deliveryDateResolvedSource',
    'deliveryDateResolvedAt',
    'region',
    'deliveryDateTime',
    'deliveryDateSource',
    'needsSchedulingReview',
  ]

  const changes = buildOrderChangeEntries(
    existing as unknown as Record<string, unknown>,
    order as unknown as Record<string, unknown>,
    candidateKeys,
  )

  await writeOrderChangeLog({
    orderId: pending.orderId,
    action: 'ORDER_UPDATED_ASK_AI',
    changes,
    actor,
    source: 'ask_ai',
  })

  return { ok: true, orderNumber: order.orderNumber }
}
