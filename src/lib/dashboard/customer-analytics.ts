import { prisma } from '@/lib/prisma'
import { ExecutiveFilters } from './executive-filters'
import { avg, diffDays, median, monthKey, monthsBetween, toCurrency } from './common'

interface CustomerOrder {
  customerId: string
  companyId: string
  orderDate: Date
  orderTotal: number
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

function groupByCustomer(orders: CustomerOrder[]): Map<string, CustomerOrder[]> {
  const map = new Map<string, CustomerOrder[]>()
  for (const order of orders) {
    const list = map.get(order.customerId) || []
    list.push(order)
    map.set(order.customerId, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
  }
  return map
}

export async function getCustomerDashboard(filters: ExecutiveFilters) {
  const raw = await prisma.companyOrder.findMany({
    where: { orderDate: { lte: filters.endDate } },
    select: {
      shopifyCustomerId: true,
      companyId: true,
      orderDate: true,
      orderTotal: true,
    },
    orderBy: [{ shopifyCustomerId: 'asc' }, { orderDate: 'asc' }],
  })

  const allOrders: CustomerOrder[] = raw
    .filter((row) => !!row.shopifyCustomerId)
    .map((row) => ({
      customerId: String(row.shopifyCustomerId),
      companyId: row.companyId,
      orderDate: row.orderDate,
      orderTotal: Number(row.orderTotal || 0),
    }))

  const byCustomer = groupByCustomer(allOrders)
  const periodOrders = allOrders.filter((order) => inRange(order.orderDate, filters.startDate, filters.endDate))
  const byCustomerPeriod = groupByCustomer(periodOrders)

  let newCustomers = 0
  let returningCustomers = 0
  for (const [customerId, periodList] of byCustomerPeriod.entries()) {
    const allList = byCustomer.get(customerId) || []
    const first = allList[0]?.orderDate
    if (!first) continue
    if (first >= filters.startDate && first <= filters.endDate) newCustomers += 1
    else returningCustomers += 1
  }

  const totalCustomers = byCustomer.size
  const ordersPerCustomer = Array.from(byCustomer.values()).map((list) => list.length)
  const averageOrdersPerCustomerAllTime = avg(ordersPerCustomer)
  const twelveMonthsAgo = new Date(filters.endDate.getTime() - 365 * 24 * 60 * 60 * 1000)
  const orders12m = allOrders.filter((order) => order.orderDate >= twelveMonthsAgo).length
  const activeCustomers12m = new Set(
    allOrders.filter((order) => order.orderDate >= twelveMonthsAgo).map((order) => order.customerId)
  ).size
  const averageOrdersPerCustomer12m = activeCustomers12m > 0 ? orders12m / activeCustomers12m : 0
  const customerLtvList = Array.from(byCustomer.values()).map((list) =>
    list.reduce((sum, order) => sum + order.orderTotal, 0)
  )
  const averageCustomerLifetimeValue = avg(customerLtvList)
  const medianCustomerLifetimeValue = median(customerLtvList)
  const repeatCustomers = ordersPerCustomer.filter((count) => count > 1).length
  const customerRepeatPurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0
  const periodRevenue = periodOrders.reduce((sum, order) => sum + order.orderTotal, 0)
  const revenueFromReturningCustomers = (() => {
    let sum = 0
    for (const [customerId, list] of byCustomerPeriod.entries()) {
      const first = byCustomer.get(customerId)?.[0]?.orderDate
      if (first && first < filters.startDate) {
        sum += list.reduce((s, order) => s + order.orderTotal, 0)
      }
    }
    return sum
  })()
  const averageDaysBetweenCustomerOrders = (() => {
    const gaps: number[] = []
    for (const list of byCustomer.values()) {
      for (let i = 1; i < list.length; i++) {
        gaps.push(diffDays(list[i - 1].orderDate, list[i].orderDate))
      }
    }
    return avg(gaps)
  })()

  const months = monthsBetween(filters.startDate, filters.endDate)
  const monthly = months.map((monthStart) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthOrders = periodOrders.filter((order) => order.orderDate >= monthStart && order.orderDate <= monthEnd)
    let newRevenue = 0
    let returningRevenue = 0
    for (const order of monthOrders) {
      const first = byCustomer.get(order.customerId)?.[0]?.orderDate
      if (first && first >= monthStart && first <= monthEnd) newRevenue += order.orderTotal
      else returningRevenue += order.orderTotal
    }
    return {
      month: monthKey(monthStart),
      newRevenue: toCurrency(newRevenue),
      returningRevenue: toCurrency(returningRevenue),
      totalRevenue: toCurrency(newRevenue + returningRevenue),
      orders: monthOrders.length,
    }
  })

  const frequencyDistribution = [
    { bucket: '1 order', count: ordersPerCustomer.filter((count) => count === 1).length },
    { bucket: '2-3 orders', count: ordersPerCustomer.filter((count) => count >= 2 && count <= 3).length },
    { bucket: '4-9 orders', count: ordersPerCustomer.filter((count) => count >= 4 && count <= 9).length },
    { bucket: '10+ orders', count: ordersPerCustomer.filter((count) => count >= 10).length },
  ]

  const byOrderNumber = (() => {
    const bucket: Record<string, { revenue: number; orders: number }> = {
      '1st order': { revenue: 0, orders: 0 },
      '2nd order': { revenue: 0, orders: 0 },
      '3rd order': { revenue: 0, orders: 0 },
      '4th+ order': { revenue: 0, orders: 0 },
    }
    for (const list of byCustomer.values()) {
      list.forEach((order, index) => {
        if (!inRange(order.orderDate, filters.startDate, filters.endDate)) return
        const key = index === 0 ? '1st order' : index === 1 ? '2nd order' : index === 2 ? '3rd order' : '4th+ order'
        bucket[key].revenue += order.orderTotal
        bucket[key].orders += 1
      })
    }
    return Object.entries(bucket).map(([segment, values]) => ({
      segment,
      revenue: toCurrency(values.revenue),
      orders: values.orders,
      averageOrderValue: values.orders > 0 ? toCurrency(values.revenue / values.orders) : 0,
    }))
  })()

  const ltvDistribution = [
    { bucket: '<$500', customers: customerLtvList.filter((value) => value < 500).length },
    { bucket: '$500-$1,999', customers: customerLtvList.filter((value) => value >= 500 && value < 2000).length },
    { bucket: '$2,000-$4,999', customers: customerLtvList.filter((value) => value >= 2000 && value < 5000).length },
    { bucket: '$5,000-$9,999', customers: customerLtvList.filter((value) => value >= 5000 && value < 10000).length },
    { bucket: '$10,000+', customers: customerLtvList.filter((value) => value >= 10000).length },
  ]

  const firstToSecondDays = (() => {
    const gaps: number[] = []
    for (const list of byCustomer.values()) {
      if (list.length > 1) gaps.push(diffDays(list[0].orderDate, list[1].orderDate))
    }
    return toCurrency(avg(gaps))
  })()

  const topLimit = filters.topCustomerLimit || 25
  const topCustomers = Array.from(byCustomer.entries())
    .map(([customerId, list]) => ({
      customerId,
      revenue: toCurrency(list.reduce((sum, order) => sum + order.orderTotal, 0)),
      orders: list.length,
      averageOrderValue: toCurrency(list.reduce((sum, order) => sum + order.orderTotal, 0) / list.length),
      lastOrderDate: list.at(-1)?.orderDate?.toISOString() || null,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topLimit)

  return {
    metrics: {
      totalCustomers,
      newCustomers,
      returningCustomers,
      averageOrdersPerCustomerAllTime: toCurrency(averageOrdersPerCustomerAllTime),
      averageOrdersPerCustomer12m: toCurrency(averageOrdersPerCustomer12m),
      averageCustomerLifetimeValue: toCurrency(averageCustomerLifetimeValue),
      medianCustomerLifetimeValue: toCurrency(medianCustomerLifetimeValue),
      customerRepeatPurchaseRate: toCurrency(customerRepeatPurchaseRate),
      revenueFromReturningCustomers: toCurrency(revenueFromReturningCustomers),
      averageDaysBetweenCustomerOrders: toCurrency(averageDaysBetweenCustomerOrders),
      periodRevenue: toCurrency(periodRevenue),
    },
    charts: {
      newVsReturningRevenue: monthly,
      orderFrequencyDistribution: frequencyDistribution,
      revenueByOrderNumber: byOrderNumber,
      ltvDistribution,
      timeBetweenFirstAndSecondOrder: firstToSecondDays,
      topCustomers,
    },
    topCustomerLimit: topLimit,
    notEnoughData: totalCustomers === 0,
  }
}
