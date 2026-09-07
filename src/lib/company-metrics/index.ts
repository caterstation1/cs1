import { prisma, withRetry } from '@/lib/prisma'

type CompanyStatus = 'new' | 'active' | 'at_risk' | 'lapsed' | 'reactivated'

interface RefreshMetricsOptions {
  full?: boolean
  monthsBack?: number
}

interface CompanyOrderLite {
  companyId: string
  shopifyCustomerId: string | null
  orderDate: Date
  orderTotal: number
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

function monthsBetweenInclusive(from: Date, to: Date): Date[] {
  const months: Date[] = []
  let cursor = startOfMonth(from)
  const limit = startOfMonth(to)
  while (cursor <= limit) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

function dayDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function computeStatus(params: {
  month: Date
  firstOrderDate: Date
  ordersThisMonth: CompanyOrderLite[]
  priorOrders: CompanyOrderLite[]
  latestOrderAtMonthEnd: Date | null
}): CompanyStatus {
  const { month, firstOrderDate, ordersThisMonth, priorOrders, latestOrderAtMonthEnd } = params
  if (startOfMonth(firstOrderDate).getTime() === startOfMonth(month).getTime()) return 'new'
  if (!latestOrderAtMonthEnd) return 'lapsed'

  if (ordersThisMonth.length > 0) {
    const lastPrior = priorOrders.length ? priorOrders[priorOrders.length - 1].orderDate : null
    if (lastPrior) {
      const inactiveDays = dayDiff(ordersThisMonth[0].orderDate, lastPrior)
      if (inactiveDays > 180) return 'reactivated'
    }
  }

  const monthEnd = endOfMonth(month)
  const sinceLatest = dayDiff(monthEnd, latestOrderAtMonthEnd)
  if (sinceLatest <= 90) return 'active'
  if (sinceLatest <= 180) return 'at_risk'
  return 'lapsed'
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function refreshCompanyAndCustomerMetrics(options: RefreshMetricsOptions = {}) {
  const nowMonth = startOfMonth(new Date())
  const lowerBound = options.full
    ? undefined
    : startOfMonth(addMonths(nowMonth, -(Math.max(1, options.monthsBack ?? 2) - 1)))

  const orders = await prisma.companyOrder.findMany({
    where: lowerBound ? { orderDate: { gte: lowerBound } } : {},
    select: {
      companyId: true,
      shopifyCustomerId: true,
      orderDate: true,
      orderTotal: true,
    },
    orderBy: { orderDate: 'asc' },
  })

  const companies = await prisma.company.findMany({
    select: {
      companyId: true,
      canonicalCompanyName: true,
      companyOrders: {
        select: {
          companyId: true,
          shopifyCustomerId: true,
          orderDate: true,
          orderTotal: true,
        },
        orderBy: { orderDate: 'asc' },
      },
    },
  })

  const companyRows: Array<{
    companyId: string
    canonicalCompanyName: string
    month: Date
    ordersCount: number
    revenue: number
    averageOrderValue: number
    uniqueContacts: number
    firstOrderDate: Date | null
    lastOrderDate: Date | null
    lifetimeOrders: number
    lifetimeRevenue: number
    monthsSinceLastOrder: number | null
    companyStatus: CompanyStatus
  }> = []

  for (const company of companies) {
    const allOrders = company.companyOrders as CompanyOrderLite[]
    if (!allOrders.length) continue
    const firstOrder = allOrders[0].orderDate
    const months = monthsBetweenInclusive(firstOrder, nowMonth)
    let lifetimeOrders = 0
    let lifetimeRevenue = 0
    let pointer = 0

    for (const month of months) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      const ordersThisMonth: CompanyOrderLite[] = []
      while (pointer < allOrders.length && allOrders[pointer].orderDate <= monthEnd) {
        const order = allOrders[pointer]
        lifetimeOrders += 1
        lifetimeRevenue += Number(order.orderTotal || 0)
        if (order.orderDate >= monthStart) {
          ordersThisMonth.push(order)
        }
        pointer += 1
      }

      const priorOrders = allOrders.filter((order) => order.orderDate < monthStart)
      const latestAtMonthEnd = allOrders
        .filter((order) => order.orderDate <= monthEnd)
        .at(-1)?.orderDate || null

      const ordersCount = ordersThisMonth.length
      const revenue = ordersThisMonth.reduce((sum, order) => sum + Number(order.orderTotal || 0), 0)
      const uniqueContacts = new Set(ordersThisMonth.map((order) => order.shopifyCustomerId).filter(Boolean)).size
      const status = computeStatus({
        month,
        firstOrderDate: firstOrder,
        ordersThisMonth,
        priorOrders,
        latestOrderAtMonthEnd: latestAtMonthEnd,
      })
      const monthsSinceLastOrder = latestAtMonthEnd
        ? (month.getUTCFullYear() - latestAtMonthEnd.getUTCFullYear()) * 12 +
          (month.getUTCMonth() - latestAtMonthEnd.getUTCMonth())
        : null

      companyRows.push({
        companyId: company.companyId,
        canonicalCompanyName: company.canonicalCompanyName,
        month,
        ordersCount,
        revenue,
        averageOrderValue: ordersCount > 0 ? revenue / ordersCount : 0,
        uniqueContacts,
        firstOrderDate: firstOrder,
        lastOrderDate: latestAtMonthEnd,
        lifetimeOrders,
        lifetimeRevenue,
        monthsSinceLastOrder,
        companyStatus: status,
      })
    }
  }

  const customerOrderRows = await prisma.companyOrder.findMany({
    where: lowerBound ? { orderDate: { gte: lowerBound } } : {},
    select: {
      companyId: true,
      shopifyCustomerId: true,
      orderDate: true,
      orderTotal: true,
    },
    orderBy: { orderDate: 'asc' },
  })

  const customerByKey = new Map<string, CompanyOrderLite[]>()
  for (const order of customerOrderRows) {
    const key = `${order.companyId}::${order.shopifyCustomerId || 'unknown'}`
    const list = customerByKey.get(key) || []
    list.push(order)
    customerByKey.set(key, list)
  }

  const customerRows: Array<{
    companyId: string | null
    shopifyCustomerId: string | null
    customerEmail: string | null
    customerName: string | null
    month: Date
    ordersCount: number
    revenue: number
    averageOrderValue: number
    firstOrderDate: Date | null
    lastOrderDate: Date | null
    lifetimeOrders: number
    lifetimeRevenue: number
    monthsSinceLastOrder: number | null
    customerStatus: CompanyStatus
  }> = []

  for (const [key, customerOrders] of customerByKey.entries()) {
    if (!customerOrders.length) continue
    const [companyId, customerId] = key.split('::')
    const firstOrder = customerOrders[0].orderDate
    const months = monthsBetweenInclusive(firstOrder, nowMonth)
    let lifetimeOrders = 0
    let lifetimeRevenue = 0
    let pointer = 0
    for (const month of months) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      const ordersThisMonth: CompanyOrderLite[] = []
      while (pointer < customerOrders.length && customerOrders[pointer].orderDate <= monthEnd) {
        const order = customerOrders[pointer]
        lifetimeOrders += 1
        lifetimeRevenue += Number(order.orderTotal || 0)
        if (order.orderDate >= monthStart) ordersThisMonth.push(order)
        pointer += 1
      }

      const priorOrders = customerOrders.filter((order) => order.orderDate < monthStart)
      const latestAtMonthEnd = customerOrders
        .filter((order) => order.orderDate <= monthEnd)
        .at(-1)?.orderDate || null

      const ordersCount = ordersThisMonth.length
      const revenue = ordersThisMonth.reduce((sum, order) => sum + Number(order.orderTotal || 0), 0)
      const status = computeStatus({
        month,
        firstOrderDate: firstOrder,
        ordersThisMonth,
        priorOrders,
        latestOrderAtMonthEnd: latestAtMonthEnd,
      })
      const monthsSinceLastOrder = latestAtMonthEnd
        ? (month.getUTCFullYear() - latestAtMonthEnd.getUTCFullYear()) * 12 +
          (month.getUTCMonth() - latestAtMonthEnd.getUTCMonth())
        : null

      customerRows.push({
        companyId: companyId || null,
        shopifyCustomerId: customerId === 'unknown' ? null : customerId,
        customerEmail: null,
        customerName: null,
        month,
        ordersCount,
        revenue,
        averageOrderValue: ordersCount > 0 ? revenue / ordersCount : 0,
        firstOrderDate: firstOrder,
        lastOrderDate: latestAtMonthEnd,
        lifetimeOrders,
        lifetimeRevenue,
        monthsSinceLastOrder,
        customerStatus: status,
      })
    }
  }

  const monthKeysToRefresh = new Set<string>()
  companyRows.forEach((row) => monthKeysToRefresh.add(toMonthKey(row.month)))
  customerRows.forEach((row) => monthKeysToRefresh.add(toMonthKey(row.month)))

  // Avoid long interactive transactions that can expire on Railway.
  for (const key of monthKeysToRefresh) {
    const [year, month] = key.split('-').map(Number)
    const monthDate = new Date(Date.UTC(year, month - 1, 1))
    await withRetry(() => prisma.companyMetricsMonthly.deleteMany({ where: { month: monthDate } }))
    await withRetry(() => prisma.customerMetricsMonthly.deleteMany({ where: { month: monthDate } }))
  }

  for (const row of companyRows) {
    await withRetry(() =>
      prisma.companyMetricsMonthly.upsert({
        where: {
          companyId_month: {
            companyId: row.companyId,
            month: row.month,
          },
        },
        create: row,
        update: row,
      })
    )
  }

  const CHUNK_SIZE = 500
  for (let i = 0; i < customerRows.length; i += CHUNK_SIZE) {
    const chunk = customerRows.slice(i, i + CHUNK_SIZE)
    if (!chunk.length) continue
    await withRetry(() =>
      prisma.customerMetricsMonthly.createMany({
        data: chunk,
        skipDuplicates: true,
      })
    )
  }

  return {
    refreshedCompanyRows: companyRows.length,
    refreshedCustomerRows: customerRows.length,
    refreshedMonths: monthKeysToRefresh.size,
    scannedOrders: orders.length,
  }
}
