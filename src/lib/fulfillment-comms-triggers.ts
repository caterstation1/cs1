import type { FulfillmentTriggerRule } from '@/lib/fulfillment-comms-service'

type OrderRow = {
  id: string
  customerEmail: string
  createdAt: Date
  totalPrice: number
  cancelledAt: Date | null
}

/**
 * Lifetime spend: sum of totalPrice for non-cancelled orders sharing the email.
 */
export function lifetimeSpendForEmail(ordersForEmail: OrderRow[]): number {
  return ordersForEmail
    .filter((o) => !o.cancelledAt)
    .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0)
}

/**
 * Ordinal position of this order for the customer (1-based), at time of that order.
 */
export function orderOrdinalForOrder(target: OrderRow, ordersForEmail: OrderRow[]): number {
  const email = String(target.customerEmail || '')
    .trim()
    .toLowerCase()
  const same = ordersForEmail.filter(
    (o) => String(o.customerEmail || '')
      .trim()
      .toLowerCase() === email && !o.cancelledAt
  )
  const t = target.createdAt.getTime()
  return same.filter((o) => o.createdAt.getTime() <= t).length
}

export interface MatchedTrigger {
  ruleId: string
  metric: 'orders' | 'spent'
  threshold: number
  suggestedRebate: string
  /** Actual value at evaluation (ordinal or lifetime spend). */
  actualValue: number
}

export function evaluateTriggersForOrder(
  order: OrderRow,
  ordersForEmail: OrderRow[],
  rules: FulfillmentTriggerRule[]
): MatchedTrigger[] {
  const lifetime = lifetimeSpendForEmail(ordersForEmail)
  const ordinal = orderOrdinalForOrder(order, ordersForEmail)
  const matched: MatchedTrigger[] = []
  for (const rule of rules) {
    if (rule.metric === 'orders') {
      if (ordinal === rule.threshold) {
        matched.push({
          ruleId: rule.id,
          metric: 'orders',
          threshold: rule.threshold,
          suggestedRebate: rule.suggestedRebate,
          actualValue: ordinal,
        })
      }
    } else {
      if (lifetime >= rule.threshold) {
        matched.push({
          ruleId: rule.id,
          metric: 'spent',
          threshold: rule.threshold,
          suggestedRebate: rule.suggestedRebate,
          actualValue: lifetime,
        })
      }
    }
  }
  return matched
}
