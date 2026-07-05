import { prisma } from '@/lib/prisma'
import { ExecutiveFilters } from './executive-filters'
import { monthKey, monthsBetween, parseProductsJson, toCurrency } from './common'

interface ProductStat {
  key: string
  product: string
  revenue: number
  orders: number
  quantity: number
  itemRevenueAvg: number
  averageOrderValueWhenIncluded: number
  repeatPurchaseRate: number
  inclusionOrderIds: Set<string>
  customerIds: Set<string>
  repeatCustomers: Set<string>
  customerOrderCounts: Map<string, number>
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function lineItemsFromPayload(payload: Record<string, any>): Array<Record<string, any>> {
  const lineItems = payload.line_items
  if (Array.isArray(lineItems)) return lineItems as Array<Record<string, any>>
  return []
}

function normalizeMainProductName(raw: string): string {
  const cleaned = raw.trim()
  if (!cleaned) return 'Unknown Product'

  // A lot of transformed titles include variant/options separated by slash.
  const slashParts = cleaned.split(' / ').map((part) => part.trim()).filter(Boolean)
  const firstPart = slashParts[0] || cleaned

  const withoutServewareSuffix = firstPart
    .replace(/\s+yes serveware.*$/i, '')
    .replace(/\s+no serveware.*$/i, '')
    .trim()

  return withoutServewareSuffix || firstPart || 'Unknown Product'
}

function normalizeProductKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isModifierOnlyName(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return true
  if (normalized.startsWith('addon:') || normalized.startsWith('add on:') || normalized.startsWith('add-on:')) {
    return true
  }
  if (
    normalized === 'no serveware' ||
    normalized === 'yes serveware' ||
    normalized === 'serveware' ||
    normalized === 'no vegan aioli' ||
    normalized === 'yes vegan aioli'
  ) {
    return true
  }
  return false
}

function hasCoreProductHint(segment: string): boolean {
  return /(station|kit|pack|series|case|slider|nacho|sando|bun|box|platter|menu)/i.test(segment)
}

function isOptionSegment(segment: string): boolean {
  const s = segment.trim()
  if (!s) return false
  if (hasCoreProductHint(s)) return false
  return /(serveware|addon|add on|aioli|pulled|brisket|chicken|beef|pork|lamb|tofu|vegan|vegetarian|\(df\)|\(gf\)|\(h\)|\+\d+|\$\d+)/i.test(
    s
  )
}

function productName(item: Record<string, any>): string | null {
  const preferred =
    item.product_title ||
    item.productTitle ||
    item.product_name ||
    item.name ||
    item.title ||
    'Unknown Product'
  const normalized = normalizeMainProductName(String(preferred))
  if (!normalized) return null
  if (isModifierOnlyName(normalized)) return null

  const parts = normalized.split(' - ').map((part) => part.trim()).filter(Boolean)
  while (parts.length > 1 && isOptionSegment(parts[parts.length - 1])) {
    parts.pop()
  }
  const cleaned = (parts.join(' - ') || normalized).replace(/[.,;:\s]+$/g, '').trim()
  if (!cleaned || isModifierOnlyName(cleaned)) return null
  return cleaned
}

export function lineItemRevenue(item: Record<string, any>): number {
  const discountedTotal =
    asNumber(item.discounted_total) ||
    asNumber(item.discounted_total_price) ||
    asNumber(item.discounted_price_set?.shop_money?.amount)
  if (discountedTotal > 0) return discountedTotal

  const linePrice =
    asNumber(item.line_price) ||
    asNumber(item.original_total_price) ||
    asNumber(item.price_set?.shop_money?.amount)
  if (linePrice > 0) return linePrice

  const quantity = asNumber(item.quantity || 1)
  const safeQuantity = quantity > 0 ? quantity : 1
  const unitPrice =
    asNumber(item.price) ||
    asNumber(item.original_price) ||
    asNumber(item.price_set?.shop_money?.amount) ||
    asNumber(item.pre_tax_price)
  return unitPrice > 0 ? unitPrice * safeQuantity : 0
}

function itemFromCompanyOrderProduct(entry: Record<string, any>): Record<string, any> {
  return {
    title: entry.title || entry.name || entry.product_title || 'Unknown Product',
    quantity: entry.quantity || 1,
    price: entry.price || entry.unit_price || entry.unitPrice || 0,
    line_price: entry.line_price || entry.total || entry.amount || 0,
  }
}

export async function getProductPerformance(filters: ExecutiveFilters) {
  const periodCompanyOrders = await prisma.companyOrder.findMany({
    where: {
      orderDate: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    },
    select: {
      shopifyOrderId: true,
      shopifyCustomerId: true,
      orderDate: true,
      orderTotal: true,
      products: true,
    },
  })
  const orderIds = Array.from(new Set(periodCompanyOrders.map((row) => row.shopifyOrderId)))
  const rawOrders =
    orderIds.length > 0
      ? await prisma.rawShopifyOrder.findMany({
          where: { shopifyOrderId: { in: orderIds } },
          select: { shopifyOrderId: true, payload: true },
        })
      : []
  const rawByOrderId = new Map<string, Record<string, any>>(
    rawOrders.map((row) => [row.shopifyOrderId, (row.payload || {}) as Record<string, any>])
  )

  const stats = new Map<string, ProductStat>()
  const cobuy = new Map<string, number>()
  const trendMap = new Map<string, Map<string, number>>() // month->product->revenue

  let totalOrderCount = 0
  let totalRevenue = 0

  for (const order of periodCompanyOrders) {
    const payload = rawByOrderId.get(order.shopifyOrderId) || {}
    const payloadItems = lineItemsFromPayload(payload)
    const companyOrderItems = parseProductsJson(order.products).map(itemFromCompanyOrderProduct)
    const lineItems = payloadItems.length ? payloadItems : companyOrderItems
    if (!lineItems.length) continue
    if (filters.product) {
      const query = filters.product.toLowerCase()
      const matches = lineItems.some((item) => {
        const name = productName(item)
        return !!name && name.toLowerCase().includes(query)
      })
      if (!matches) continue
    }

    totalOrderCount += 1
    const orderRevenue = asNumber(order.orderTotal)
    totalRevenue += orderRevenue
    const customerId = String(
      order.shopifyCustomerId || payload?.customer?.id || payload?.customer?.email || 'unknown'
    )
    const orderProducts = new Set<string>()

    for (const item of lineItems) {
      const name = productName(item)
      if (!name) continue
      const key = normalizeProductKey(name)
      if (!key) continue
      orderProducts.add(key)
      const qty = asNumber(item.quantity || 1)
      const revenue = lineItemRevenue(item)

      const current = stats.get(key) || {
        key,
        product: name,
        revenue: 0,
        orders: 0,
        quantity: 0,
        itemRevenueAvg: 0,
        averageOrderValueWhenIncluded: 0,
        repeatPurchaseRate: 0,
        inclusionOrderIds: new Set<string>(),
        customerIds: new Set<string>(),
        repeatCustomers: new Set<string>(),
        customerOrderCounts: new Map<string, number>(),
      }
      current.revenue += revenue
      current.quantity += qty
      current.customerIds.add(customerId)
      current.inclusionOrderIds.add(order.shopifyOrderId)
      const previousCustomerOrders = current.customerOrderCounts.get(customerId) || 0
      current.customerOrderCounts.set(customerId, previousCustomerOrders + 1)
      if (previousCustomerOrders + 1 >= 2) {
        current.repeatCustomers.add(customerId)
      }
      stats.set(key, current)

      const month = monthKey(order.orderDate)
      const monthMap = trendMap.get(month) || new Map<string, number>()
      monthMap.set(key, (monthMap.get(key) || 0) + revenue)
      trendMap.set(month, monthMap)
    }

    for (const key of orderProducts) {
      const current = stats.get(key)
      if (current) {
        current.orders += 1
        current.averageOrderValueWhenIncluded += orderRevenue
      }
    }

    const uniqueProducts = Array.from(orderProducts).sort()
    for (let i = 0; i < uniqueProducts.length; i++) {
      for (let j = i + 1; j < uniqueProducts.length; j++) {
        const key = `${uniqueProducts[i]}|||${uniqueProducts[j]}`
        cobuy.set(key, (cobuy.get(key) || 0) + 1)
      }
    }
  }

  const rows = Array.from(stats.values()).map((stat) => {
    const orders = stat.orders || 1
    const customerCount = stat.customerIds.size || 1
    return {
      key: stat.key,
      product: stat.product,
      revenue: toCurrency(stat.revenue),
      orders: stat.orders,
      quantity: stat.quantity,
      averageItemRevenue: stat.quantity > 0 ? toCurrency(stat.revenue / stat.quantity) : 0,
      averageOrderValueWhenIncluded: toCurrency(stat.averageOrderValueWhenIncluded / orders),
      repeatPurchaseRate: toCurrency((stat.repeatCustomers.size / customerCount) * 100),
      revenueSharePct: totalRevenue > 0 ? toCurrency((stat.revenue / totalRevenue) * 100) : 0,
      orderSharePct: totalOrderCount > 0 ? toCurrency((stat.orders / totalOrderCount) * 100) : 0,
    }
  })

  const averageOrderValueOverall = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0
  const sortedByRevenue = [...rows].sort((a, b) => b.revenue - a.revenue)
  const heroProducts = sortedByRevenue.filter((row) => row.revenueSharePct >= 2 && row.repeatPurchaseRate >= 20).slice(0, 20)

  const months = monthsBetween(filters.startDate, filters.endDate).map(monthKey)
  const growthRows = rows.map((row) => {
    const firstHalf = months.slice(0, Math.floor(months.length / 2))
    const secondHalf = months.slice(Math.floor(months.length / 2))
    const first = firstHalf.reduce((sum, month) => sum + (trendMap.get(month)?.get(row.key) || 0), 0)
    const second = secondHalf.reduce((sum, month) => sum + (trendMap.get(month)?.get(row.key) || 0), 0)
    const growthPct = first > 0 ? ((second - first) / first) * 100 : second > 0 ? 100 : 0
    return { ...row, growthPct: toCurrency(growthPct) }
  })
  const fastestGrowingProducts = [...growthRows].sort((a, b) => b.growthPct - a.growthPct).slice(0, 20)
  const productsIncreasingAov = rows
    .filter((row) => row.averageOrderValueWhenIncluded > averageOrderValueOverall)
    .sort((a, b) => b.averageOrderValueWhenIncluded - a.averageOrderValueWhenIncluded)
    .slice(0, 20)
  const underperformingProducts = rows
    .filter((row) => row.revenueSharePct < 0.5 && row.orderSharePct < 0.5)
    .sort((a, b) => a.revenue - b.revenue)
    .slice(0, 20)
  const repeatRateRanking = [...rows].sort(
    (a, b) => b.repeatPurchaseRate - a.repeatPurchaseRate || b.orders - a.orders
  )

  const productRevenueTrend = months.map((month) => {
    const monthMap = trendMap.get(month) || new Map<string, number>()
    return {
      month,
      revenue: toCurrency(Array.from(monthMap.values()).reduce((sum, value) => sum + value, 0)),
    }
  })

  const commonlyBoughtTogether = Array.from(cobuy.entries())
    .map(([key, count]) => {
      const [leftKey, rightKey] = key.split('|||')
      return {
        left: stats.get(leftKey)?.product || leftKey,
        right: stats.get(rightKey)?.product || rightKey,
        count,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const stripKey = <T extends { key: string }>(row: T) => {
    const { key: _ignored, ...rest } = row
    return rest
  }

  return {
    summary: {
      totalProducts: rows.length,
      totalRevenue: toCurrency(totalRevenue),
      totalOrders: totalOrderCount,
      averageOrderValueOverall: toCurrency(averageOrderValueOverall),
    },
    productMetrics: rows.sort((a, b) => b.revenue - a.revenue).map(stripKey),
    repeatRateRanking: repeatRateRanking.map(stripKey),
    productRevenueTrend,
    commonlyBoughtTogether,
    heroProducts: heroProducts.map(stripKey),
    fastestGrowingProducts: fastestGrowingProducts.map(stripKey),
    productsIncreasingAov: productsIncreasingAov.map(stripKey),
    underperformingProducts: underperformingProducts.map(stripKey),
    notEnoughData: rows.length === 0,
  }
}
