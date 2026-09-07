type OrderDateFields = {
  deliveryDateResolved?: Date | null
  deliveryDateTime?: Date | null
  deliveryDate?: string | null
  pickupDate?: string | null
}

/** Best-effort YYYY-MM-DD for label printing from an order record. */
export function resolveOrderDeliveryYmd(order: OrderDateFields): string | null {
  if (order.deliveryDateResolved) {
    return order.deliveryDateResolved.toISOString().slice(0, 10)
  }
  if (order.deliveryDateTime) {
    return order.deliveryDateTime.toISOString().slice(0, 10)
  }
  if (order.deliveryDate && /^\d{4}-\d{2}-\d{2}/.test(order.deliveryDate)) {
    return order.deliveryDate.slice(0, 10)
  }
  if (order.pickupDate && /^\d{4}-\d{2}-\d{2}/.test(order.pickupDate)) {
    return order.pickupDate.slice(0, 10)
  }
  return null
}

export function buildLabelPrintUrl(orderNumber: number): string {
  return `/labels/print?orderNumber=${orderNumber}`
}
