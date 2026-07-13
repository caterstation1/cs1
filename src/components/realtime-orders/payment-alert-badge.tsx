'use client'

import { Order } from '@/types/order'
import { parseLocalDate } from '@/lib/date-utils'

// Shopify "Awaiting payment" = financial_status "pending"
const AWAITING_PAYMENT_STATUS = 'pending'

/**
 * Weekend unpaid-order alert:
 * shown when the order's delivery day is a Saturday or Sunday and the
 * customer did not pay at Shopify checkout (financial status "pending").
 * If it's also the customer's first order, the label calls that out.
 */
export function getWeekendAwaitingPaymentAlert(
  order: Order
): { label: string; title: string } | null {
  const financialStatus = (order.financialStatus || '').toLowerCase()
  if (financialStatus !== AWAITING_PAYMENT_STATUS) return null

  const rawDate = order.deliveryDateResolved || order.deliveryDate
  if (!rawDate) return null
  const date = parseLocalDate(String(rawDate))
  if (!date) return null

  const day = date.getDay()
  if (day !== 0 && day !== 6) return null

  if (order.isFirstOrder) {
    return {
      label: '$$ 1st order',
      title: "Awaiting payment — customer's first order",
    }
  }
  return { label: '$$', title: 'Awaiting payment' }
}

export function PaymentAlertBadge({
  order,
  className = '',
}: {
  order: Order
  className?: string
}) {
  const alert = getWeekendAwaitingPaymentAlert(order)
  if (!alert) return null
  return (
    <span
      className={`text-red-600 font-bold text-sm whitespace-nowrap ${className}`}
      title={alert.title}
    >
      {alert.label}
    </span>
  )
}
