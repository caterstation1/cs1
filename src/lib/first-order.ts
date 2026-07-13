import { prisma, withRetry } from '@/lib/prisma'

/**
 * Batch-computes an `isFirstOrder` flag for a page of orders.
 *
 * An order is the customer's first order when its orderNumber equals the
 * lowest orderNumber ever recorded for that customer email (case-insensitive).
 * Uses a single groupBy query for the whole page to avoid N+1 lookups.
 */
export async function attachIsFirstOrderFlag<
  T extends { customerEmail: string | null; orderNumber: number }
>(orders: T[]): Promise<(T & { isFirstOrder: boolean })[]> {
  const emails = Array.from(
    new Set(
      orders
        .map((o) => (o.customerEmail || '').trim())
        .filter((e) => e.length > 0)
    )
  )

  const minOrderNumberByEmail = new Map<string, number>()
  if (emails.length > 0) {
    const groups = await withRetry(async () => {
      return await prisma.order.groupBy({
        by: ['customerEmail'],
        where: { customerEmail: { in: emails, mode: 'insensitive' } },
        _min: { orderNumber: true },
      })
    })
    for (const group of groups) {
      const key = (group.customerEmail || '').trim().toLowerCase()
      const min = group._min.orderNumber
      if (!key || min === null || min === undefined) continue
      const existing = minOrderNumberByEmail.get(key)
      if (existing === undefined || min < existing) {
        minOrderNumberByEmail.set(key, min)
      }
    }
  }

  return orders.map((order) => {
    const key = (order.customerEmail || '').trim().toLowerCase()
    const min = key ? minOrderNumberByEmail.get(key) : undefined
    return { ...order, isFirstOrder: min !== undefined && order.orderNumber === min }
  })
}
