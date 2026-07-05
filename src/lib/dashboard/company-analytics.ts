import { prisma } from '@/lib/prisma'
import { ExecutiveFilters } from './executive-filters'
import {
  CompanyRollup,
  CompanyStatus,
  avg,
  classifyGrowthOpportunity,
  companyStatusFromDates,
  diffDays,
  formatAddress,
  median,
  monthKey,
  monthsBetween,
  parseProductsJson,
  recommendedAction,
  toCurrency,
} from './common'
import {
  extractEmailRootDomain,
  extractBusinessDomain,
  isGenericEmailDomain,
  normalizeCompanyName,
} from '@/lib/company-matching'

type CompanyOrderRow = {
  companyId: string
  shopifyOrderId: string
  shopifyCustomerId: string | null
  orderDate: Date
  orderTotal: number
  products: unknown
  deliveryAddress?: unknown
  matchMethod?: string
}

interface CompanyGraph {
  rollups: CompanyRollup[]
  periodOrders: CompanyOrderRow[]
  allOrdersToEnd: CompanyOrderRow[]
  periodOrdersAll: CompanyOrderRow[]
  privatePeriodRevenue: number
  privatePeriodOrders: number
}

type CompanyMeta = {
  companyId: string
  canonicalCompanyName: string
  primaryDomain: string | null
  alternateDomains: string[]
  primaryAddress: unknown
  confidenceScore: number
  city: string | null
  region: string | null
  country: string | null
  contacts: Array<{
    email: string | null
    shopifyCustomerId: string | null
    firstName: string | null
    lastName: string | null
  }>
}

export interface OrderNumberBucketRow {
  bucket: '1st order' | '2nd order' | '3rd order' | '4th+ order'
  revenue: number
  orders: number
  averageOrderValue: number
  revenuePct: number
}

export interface ValidationCheck {
  id: string
  level: 'warning' | 'error'
  message: string
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

function compareValue(a: any, b: any): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function hasProduct(order: CompanyOrderRow, productFilter?: string): boolean {
  if (!productFilter) return true
  const target = productFilter.toLowerCase()
  const items = parseProductsJson(order.products)
  return items.some((item) => {
    const title = String(item?.title || item?.name || item?.product_title || '').toLowerCase()
    return title.includes(target)
  })
}

export function isPrivateUnmatchedCompanyName(name: string | null | undefined): boolean {
  if (!name) return false
  const normalized = name.trim().toLowerCase()
  return (
    normalized === 'private customer' ||
    normalized.startsWith('private customer ') ||
    normalized === 'unmatched customer' ||
    normalized.includes('walk in')
  )
}

export function isNewCompanyInPeriod(
  firstOrderDate: Date | null,
  startDate: Date,
  endDate: Date
): boolean {
  return !!firstOrderDate && firstOrderDate >= startDate && firstOrderDate <= endDate
}

export function isReturningCompanyInPeriod(
  firstOrderDate: Date | null,
  startDate: Date,
  hasOrderInPeriod: boolean
): boolean {
  return hasOrderInPeriod && !!firstOrderDate && firstOrderDate < startDate
}

export function countActiveCompaniesInOrders(orders: Array<{ companyId: string }>): number {
  return new Set(orders.map((order) => order.companyId)).size
}

export function computeAverageOrdersPerCompany(orderCount: number, companyCount: number): number {
  if (companyCount <= 0) return 0
  return orderCount / companyCount
}

export function aggregateCompanyTotalsFromRows(
  rows: Array<{
    companyId: string
    domain: string | null
    shopifyOrderId: string
    orderTotal: number
    customerKey?: string | null
  }>
): Array<{
  key: string
  revenue: number
  orders: number
  contacts: number
}> {
  const grouped = new Map<
    string,
    { orderTotalsById: Map<string, number>; contacts: Set<string> }
  >()
  for (const row of rows) {
    const rootDomain = row.domain
      ? extractEmailRootDomain(`noreply@${row.domain}`) || row.domain.toLowerCase()
      : null
    const companyKey =
      rootDomain && !isGenericEmailDomain(rootDomain) ? `domain:${rootDomain}` : `company:${row.companyId}`
    const current = grouped.get(companyKey) || {
      orderTotalsById: new Map<string, number>(),
      contacts: new Set<string>(),
    }
    current.orderTotalsById.set(row.shopifyOrderId, Number(row.orderTotal || 0))
    if (row.customerKey) current.contacts.add(String(row.customerKey).toLowerCase())
    grouped.set(companyKey, current)
  }
  return Array.from(grouped.entries()).map(([key, value]) => ({
    key,
    revenue: toCurrency(Array.from(value.orderTotalsById.values()).reduce((sum, total) => sum + total, 0)),
    orders: value.orderTotalsById.size,
    contacts: value.contacts.size,
  }))
}

function sumProductRevenueFromCompanyOrders(orders: CompanyOrderRow[]): number {
  return orders.reduce((sum, order) => {
    const items = parseProductsJson(order.products)
    if (!items.length) return sum
    let orderProductRevenue = 0
    for (const item of items) {
      const quantity = Number(item?.quantity ?? 1)
      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
      const explicitTotal = Number(item?.line_price ?? item?.total ?? item?.amount ?? 0)
      if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
        orderProductRevenue += explicitTotal
        continue
      }
      const unitPrice = Number(item?.price ?? item?.unit_price ?? 0)
      if (Number.isFinite(unitPrice) && unitPrice > 0) {
        orderProductRevenue += unitPrice * safeQuantity
      }
    }
    return sum + orderProductRevenue
  }, 0)
}

function nonGenericBusinessDomain(domains: Array<string | null | undefined>): string | null {
  for (const domainRaw of domains) {
    const domain = domainRaw?.toLowerCase().trim()
    if (!domain) continue
    const root = extractEmailRootDomain(`noreply@${domain}`) || domain
    if (!isGenericEmailDomain(root)) return root
  }
  return null
}

function bestBusinessDomainForCompany(company: CompanyMeta): string | null {
  const all = [company.primaryDomain, ...(company.alternateDomains || [])]
  return nonGenericBusinessDomain(all)
}

function clusterKeyForCompany(company: CompanyMeta): string {
  const domain = bestBusinessDomainForCompany(company)
  return domain ? `domain:${domain}` : `company:${company.companyId}`
}

function isPrivateCluster(params: {
  companyNames: string[]
  domain: string | null
  contactEmails: string[]
}): boolean {
  if (params.domain) return false
  const allNamesPrivate = params.companyNames.every((name) => isPrivateUnmatchedCompanyName(name))
  if (allNamesPrivate) return true
  const allContactsGenericOrMissing =
    params.contactEmails.length > 0 &&
    params.contactEmails.every((email) => {
      const domain = extractEmailRootDomain(email)
      return !domain || isGenericEmailDomain(domain)
    })
  return allContactsGenericOrMissing
}

async function loadCompanyGraph(filters: ExecutiveFilters): Promise<CompanyGraph> {
  const companies = await prisma.company.findMany({
    where: {
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.minConfidence != null ? { confidenceScore: { gte: filters.minConfidence } } : {}),
    },
    select: {
      companyId: true,
      canonicalCompanyName: true,
      primaryDomain: true,
      alternateDomains: true,
      primaryAddress: true,
      confidenceScore: true,
      city: true,
      region: true,
      country: true,
      contacts: {
        select: {
          email: true,
          shopifyCustomerId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  const companyIds = companies.map((company) => company.companyId)
  if (!companyIds.length) {
    return {
      rollups: [],
      periodOrders: [],
      allOrdersToEnd: [],
      periodOrdersAll: [],
      privatePeriodRevenue: 0,
      privatePeriodOrders: 0,
    }
  }

  const allOrdersToEndRaw = await prisma.companyOrder.findMany({
    where: {
      companyId: { in: companyIds },
      orderDate: { lte: filters.endDate },
    },
    select: {
      companyId: true,
      shopifyOrderId: true,
      shopifyCustomerId: true,
      orderDate: true,
      orderTotal: true,
      products: true,
      deliveryAddress: true,
      matchMethod: true,
    },
    orderBy: [{ companyId: 'asc' }, { orderDate: 'asc' }],
  })

  const allOrdersToEnd: CompanyOrderRow[] = allOrdersToEndRaw.map((row) => ({
    ...row,
    orderTotal: Number(row.orderTotal || 0),
  }))
  const periodOrdersAllRaw = allOrdersToEnd.filter(
    (order) =>
      inRange(order.orderDate, filters.startDate, filters.endDate) &&
      hasProduct(order, filters.product)
  )
  const companyMetaById = new Map<string, CompanyMeta>(companies.map((company) => [company.companyId, company]))
  const clusterByKey = new Map<
    string,
    {
      clusterKey: string
      domain: string | null
      companyIds: Set<string>
      companyNames: Set<string>
      normalizedCompanyNames: Set<string>
      confidenceScores: number[]
      addresses: unknown[]
      contactEmails: Set<string>
      contactCustomerIds: Set<string>
      allOrders: CompanyOrderRow[]
      periodOrders: CompanyOrderRow[]
    }
  >()

  const allOrderCompanyIds = new Set(allOrdersToEnd.map((row) => row.companyId))
  for (const companyId of allOrderCompanyIds) {
    const company = companyMetaById.get(companyId)
    if (!company) continue
    const key = clusterKeyForCompany(company)
    const existing =
      clusterByKey.get(key) ||
      {
        clusterKey: key,
        domain: bestBusinessDomainForCompany(company),
        companyIds: new Set<string>(),
        companyNames: new Set<string>(),
        normalizedCompanyNames: new Set<string>(),
        confidenceScores: [] as number[],
        addresses: [] as unknown[],
        contactEmails: new Set<string>(),
        contactCustomerIds: new Set<string>(),
        allOrders: [] as CompanyOrderRow[],
        periodOrders: [] as CompanyOrderRow[],
      }
    existing.companyIds.add(company.companyId)
    existing.companyNames.add(company.canonicalCompanyName)
    existing.normalizedCompanyNames.add(normalizeCompanyName(company.canonicalCompanyName))
    existing.confidenceScores.push(company.confidenceScore)
    existing.addresses.push(company.primaryAddress)
    for (const contact of company.contacts || []) {
      if (contact.email) existing.contactEmails.add(contact.email)
      if (contact.shopifyCustomerId) existing.contactCustomerIds.add(contact.shopifyCustomerId)
    }
    clusterByKey.set(key, existing)
  }

  for (const order of allOrdersToEnd) {
    const company = companyMetaById.get(order.companyId)
    if (!company) continue
    const key = clusterKeyForCompany(company)
    const cluster = clusterByKey.get(key)
    if (!cluster) continue
    cluster.allOrders.push({ ...order, companyId: key })
  }
  for (const order of periodOrdersAllRaw) {
    const company = companyMetaById.get(order.companyId)
    if (!company) continue
    const key = clusterKeyForCompany(company)
    const cluster = clusterByKey.get(key)
    if (!cluster) continue
    cluster.periodOrders.push({ ...order, companyId: key })
  }

  const clusters = Array.from(clusterByKey.values()).map((cluster) => {
    const uniqueAllOrdersByShopifyId = new Map<string, CompanyOrderRow>()
    for (const order of cluster.allOrders) uniqueAllOrdersByShopifyId.set(order.shopifyOrderId, order)
    const uniquePeriodOrdersByShopifyId = new Map<string, CompanyOrderRow>()
    for (const order of cluster.periodOrders) uniquePeriodOrdersByShopifyId.set(order.shopifyOrderId, order)
    const dedupedAllOrders = Array.from(uniqueAllOrdersByShopifyId.values()).sort(
      (a, b) => a.orderDate.getTime() - b.orderDate.getTime()
    )
    const dedupedPeriodOrders = Array.from(uniquePeriodOrdersByShopifyId.values()).sort(
      (a, b) => a.orderDate.getTime() - b.orderDate.getTime()
    )
    return {
      ...cluster,
      allOrders: dedupedAllOrders,
      periodOrders: dedupedPeriodOrders,
    }
  })

  const privateClusterKeys = new Set(
    clusters
      .filter((cluster) =>
        isPrivateCluster({
          companyNames: Array.from(cluster.companyNames),
          domain: cluster.domain,
          contactEmails: Array.from(cluster.contactEmails),
        })
      )
      .map((cluster) => cluster.clusterKey)
  )

  const includePrivateUnmatched = filters.includePrivateUnmatched
  const periodOrdersAll = clusters.flatMap((cluster) => cluster.periodOrders)
  const privatePeriodOrders = periodOrdersAll.filter((order) => privateClusterKeys.has(order.companyId))
  const privatePeriodRevenue = privatePeriodOrders.reduce((sum, order) => sum + order.orderTotal, 0)

  const allowedClusters = clusters.filter(
    (cluster) => includePrivateUnmatched || !privateClusterKeys.has(cluster.clusterKey)
  )
  const periodOrders = allowedClusters.flatMap((cluster) => cluster.periodOrders)
  const allOrdersToEndGrouped = allowedClusters.flatMap((cluster) => cluster.allOrders)

  const rollups: CompanyRollup[] = allowedClusters.map((cluster) => {
    const all = cluster.allOrders
    const period = cluster.periodOrders
    const periodRevenue = period.reduce((sum, order) => sum + Number(order.orderTotal || 0), 0)
    const periodOrdersCount = period.length
    const lifetimeRevenue = all.reduce((sum, order) => sum + Number(order.orderTotal || 0), 0)
    const lifetimeOrders = all.length
    const firstOrderDate = all[0]?.orderDate || null
    const lastOrderDate = all.at(-1)?.orderDate || null
    const hadOrderInPeriod = periodOrdersCount > 0
    const priorOrder = all.filter((order) => order.orderDate < filters.startDate).at(-1) || null
    const firstInPeriod = period[0] || null
    const priorGapDays =
      priorOrder && firstInPeriod ? diffDays(priorOrder.orderDate, firstInPeriod.orderDate) : null

    let status: CompanyStatus = companyStatusFromDates(
      firstOrderDate,
      lastOrderDate,
      filters.endDate,
      hadOrderInPeriod,
      priorGapDays
    )
    const isNewInPeriod = isNewCompanyInPeriod(firstOrderDate, filters.startDate, filters.endDate)
    const isReturningInPeriod = isReturningCompanyInPeriod(firstOrderDate, filters.startDate, hadOrderInPeriod)
    if (isNewInPeriod) status = 'new'

    const companyName =
      Array.from(cluster.companyNames).sort((a, b) => b.length - a.length)[0] || 'Unknown Company'
    const primaryAddress = formatAddress(cluster.addresses.find((entry) => !!entry))
    const contacts = new Set([
      ...Array.from(cluster.contactCustomerIds),
      ...Array.from(cluster.contactEmails).map((email) => email.toLowerCase()),
    ]).size

    return {
      companyId: Array.from(cluster.companyIds)[0] || cluster.clusterKey,
      rollupKey: cluster.clusterKey,
      companyName,
      lifetimeRevenue: toCurrency(lifetimeRevenue),
      lifetimeOrders,
      avgOrderValue: lifetimeOrders > 0 ? toCurrency(lifetimeRevenue / lifetimeOrders) : 0,
      firstOrderDate,
      lastOrderDate,
      daysSinceLastOrder: lastOrderDate ? diffDays(lastOrderDate, filters.endDate) : null,
      contacts,
      confidenceScore: Math.max(...cluster.confidenceScores, 0),
      primaryDomain: cluster.domain,
      primaryAddress,
      status,
      periodRevenue: toCurrency(periodRevenue),
      periodOrders: periodOrdersCount,
      isNewInPeriod,
      isReturningInPeriod,
    }
  })

  let filteredRollups = rollups.filter((row) => row.periodOrders > 0 || row.lifetimeOrders > 0)
  if (filters.companyStatus) {
    filteredRollups = filteredRollups.filter((row) => row.status === filters.companyStatus)
  }
  if (filters.revenueTier) {
    filteredRollups = filteredRollups.filter((row) => {
      const rev = row.lifetimeRevenue
      switch (filters.revenueTier) {
        case 'lt500':
          return rev < 500
        case '500_1999':
          return rev >= 500 && rev < 2000
        case '2000_4999':
          return rev >= 2000 && rev < 5000
        case '5000_9999':
          return rev >= 5000 && rev < 10000
        case '10000_plus':
          return rev >= 10000
        default:
          return true
      }
    })
  }
  if (filters.orderCountTier) {
    filteredRollups = filteredRollups.filter((row) => {
      const count = row.lifetimeOrders
      switch (filters.orderCountTier) {
        case '1':
          return count === 1
        case '2_3':
          return count >= 2 && count <= 3
        case '4_9':
          return count >= 4 && count <= 9
        case '10_plus':
          return count >= 10
        default:
          return true
      }
    })
  }
  if (filters.newVsReturning) {
    filteredRollups = filteredRollups.filter((row) =>
      filters.newVsReturning === 'new' ? row.isNewInPeriod : row.isReturningInPeriod
    )
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filteredRollups = filteredRollups.filter(
      (row) =>
        row.companyName.toLowerCase().includes(q) ||
        (row.primaryDomain || '').toLowerCase().includes(q) ||
        row.primaryAddress.toLowerCase().includes(q)
    )
  }

  const allowedIds = new Set(filteredRollups.map((row) => row.companyId))
  const allowedRollupKeys = new Set(filteredRollups.map((row) => row.rollupKey || row.companyId))
  return {
    rollups: filteredRollups,
    periodOrders: periodOrders.filter((order) => allowedRollupKeys.has(order.companyId)),
    allOrdersToEnd: allOrdersToEndGrouped.filter((order) => allowedRollupKeys.has(order.companyId)),
    periodOrdersAll,
    privatePeriodRevenue,
    privatePeriodOrders: privatePeriodOrders.length,
  }
}

export async function getExecutiveSummary(filters: ExecutiveFilters) {
  const graph = await loadCompanyGraph(filters)
  const { rollups, periodOrders, allOrdersToEnd, periodOrdersAll, privatePeriodRevenue, privatePeriodOrders } =
    graph
  // Total revenue/order cards include private/unmatched by default.
  const totalRevenue = toCurrency(periodOrdersAll.reduce((sum, order) => sum + order.orderTotal, 0))
  const totalOrders = periodOrdersAll.length
  const averageOrderValue = totalOrders > 0 ? toCurrency(totalRevenue / totalOrders) : 0

  const activeCompanies = countActiveCompaniesInOrders(periodOrders)
  const newCompanies = rollups.filter((row) => row.isNewInPeriod).length
  const returningCompanies = rollups.filter((row) => row.isReturningInPeriod).length

  const totalCompanies = rollups.length
  const averageOrdersPerCompanyAllTime = avg(rollups.map((row) => row.lifetimeOrders))
  const last12MonthsStart = new Date(filters.endDate.getTime() - 365 * 24 * 60 * 60 * 1000)
  const ordersLast12m = allOrdersToEnd.filter((order) => order.orderDate >= last12MonthsStart)
  const activeCompaniesLast12m = countActiveCompaniesInOrders(ordersLast12m)
  const averageOrdersPerCompany12m = computeAverageOrdersPerCompany(
    ordersLast12m.length,
    activeCompaniesLast12m
  )

  const selectedCompanyRevenue = periodOrders.reduce((sum, order) => sum + order.orderTotal, 0)
  const averageRevenuePerCompany = activeCompanies > 0 ? selectedCompanyRevenue / activeCompanies : 0
  const medianRevenuePerCompany = median(rollups.map((row) => row.periodRevenue))
  const companyLifetimeValue =
    totalCompanies > 0
      ? toCurrency(rollups.reduce((sum, row) => sum + row.lifetimeRevenue, 0) / totalCompanies)
      : 0

  const revenueFromReturningCompanies = toCurrency(
    rollups.filter((row) => row.isReturningInPeriod).reduce((sum, row) => sum + row.periodRevenue, 0)
  )
  const repeatCompanyRevenuePct =
    selectedCompanyRevenue > 0 ? (revenueFromReturningCompanies / selectedCompanyRevenue) * 100 : 0

  const avgDaysBetweenCompanyOrders = (() => {
    const gaps: number[] = []
    const byCompany = new Map<string, CompanyOrderRow[]>()
    for (const order of allOrdersToEnd) {
      const list = byCompany.get(order.companyId) || []
      list.push(order)
      byCompany.set(order.companyId, list)
    }
    for (const orders of byCompany.values()) {
      for (let i = 1; i < orders.length; i++) {
        gaps.push(diffDays(orders[i - 1].orderDate, orders[i].orderDate))
      }
    }
    return gaps.length ? avg(gaps) : 0
  })()

  const atRiskCompanies = rollups.filter((row) => row.status === 'at_risk').length
  const lapsedCompanies = rollups.filter((row) => row.status === 'lapsed').length
  const revenueSorted = [...rollups].sort((a, b) => b.periodRevenue - a.periodRevenue)
  const top10Revenue = revenueSorted.slice(0, 10).reduce((sum, row) => sum + row.periodRevenue, 0)
  const top25Revenue = revenueSorted.slice(0, 25).reduce((sum, row) => sum + row.periodRevenue, 0)
  const monthlyRevenueSum = toCurrency(
    monthsBetween(filters.startDate, filters.endDate).reduce((sum, monthStart) => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthRevenue = periodOrdersAll
        .filter((order) => order.orderDate >= monthStart && order.orderDate <= monthEnd)
        .reduce((monthSum, order) => monthSum + order.orderTotal, 0)
      return sum + monthRevenue
    }, 0)
  )
  const productRevenue = toCurrency(sumProductRevenueFromCompanyOrders(periodOrdersAll))
  const privateRevenueSharePct = totalRevenue > 0 ? toCurrency((privatePeriodRevenue / totalRevenue) * 100) : 0

  const validationChecks: ValidationCheck[] = []
  if (activeCompanies < returningCompanies) {
    validationChecks.push({
      id: 'active-lt-returning',
      level: 'error',
      message: 'Active companies is lower than returning companies; check company-period joins.',
    })
  }
  if (averageOrdersPerCompany12m > 100) {
    validationChecks.push({
      id: 'avg-orders-12m-high',
      level: 'warning',
      message: `Average orders/company (12m) is unusually high (${toCurrency(averageOrdersPerCompany12m)}).`,
    })
  }
  if (Math.abs(totalRevenue - monthlyRevenueSum) > 1) {
    validationChecks.push({
      id: 'revenue-reconcile-monthly',
      level: 'error',
      message: 'Total revenue does not reconcile with monthly revenue sum.',
    })
  }
  if (totalRevenue > 0 && productRevenue < totalRevenue * 0.5) {
    validationChecks.push({
      id: 'product-revenue-low',
      level: 'warning',
      message: 'Product revenue is less than 50% of order revenue; inspect line-item parsing.',
    })
  }
  if (privateRevenueSharePct > 10) {
    validationChecks.push({
      id: 'private-revenue-share-high',
      level: 'warning',
      message: `Private/unmatched revenue share is high (${privateRevenueSharePct}%).`,
    })
  }

  return {
    cards: {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      activeCompanies,
      newCompanies,
      returningCompanies,
      averageOrdersPerCompanyAllTime: toCurrency(averageOrdersPerCompanyAllTime),
      averageOrdersPerCompany12m: toCurrency(averageOrdersPerCompany12m),
      averageRevenuePerCompany: toCurrency(averageRevenuePerCompany),
      medianRevenuePerCompany: toCurrency(medianRevenuePerCompany),
      companyLifetimeValue,
      revenueFromReturningCompanies,
      repeatCompanyRevenuePct: toCurrency(repeatCompanyRevenuePct),
      averageDaysBetweenCompanyOrders: toCurrency(avgDaysBetweenCompanyOrders),
      atRiskCompanies,
      lapsedCompanies,
      revenueFromTop10CompaniesPct:
        selectedCompanyRevenue > 0 ? toCurrency((top10Revenue / selectedCompanyRevenue) * 100) : 0,
      revenueFromTop25CompaniesPct:
        selectedCompanyRevenue > 0 ? toCurrency((top25Revenue / selectedCompanyRevenue) * 100) : 0,
      privateRevenueSharePct,
      privateOrders: privatePeriodOrders,
      companyRevenueExcludingPrivate: toCurrency(selectedCompanyRevenue),
      includePrivateUnmatchedInCompanyMetrics: filters.includePrivateUnmatched,
    },
    validationChecks,
    notEnoughData: totalOrders === 0,
  }
}

export async function getRevenueTrends(filters: ExecutiveFilters) {
  const { rollups, periodOrders, allOrdersToEnd } = await loadCompanyGraph(filters)
  const months = monthsBetween(filters.startDate, filters.endDate)

  const byCompanyFirstOrder = new Map<string, Date | null>(
    rollups.map((row) => [row.rollupKey || row.companyId, row.firstOrderDate])
  )
  const monthRows = months.map((monthStart) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthOrders = periodOrders.filter((order) => order.orderDate >= monthStart && order.orderDate <= monthEnd)
    const revenue = monthOrders.reduce((sum, order) => sum + order.orderTotal, 0)
    const orders = monthOrders.length

    let newRevenue = 0
    let returningRevenue = 0
    let newOrders = 0
    let returningOrders = 0
    const activeCompanies = new Set<string>()
    const newCompanies = new Set<string>()
    const reactivatedCompanies = new Set<string>()

    for (const order of monthOrders) {
      activeCompanies.add(order.companyId)
      const firstOrderDate = byCompanyFirstOrder.get(order.companyId)
      if (firstOrderDate && firstOrderDate >= monthStart && firstOrderDate <= monthEnd) {
        newRevenue += order.orderTotal
        newOrders += 1
        newCompanies.add(order.companyId)
      } else {
        returningRevenue += order.orderTotal
        returningOrders += 1
      }

      const prior = allOrdersToEnd
        .filter((candidate) => candidate.companyId === order.companyId && candidate.orderDate < monthStart)
        .at(-1)
      if (prior && diffDays(prior.orderDate, order.orderDate) > 180) {
        reactivatedCompanies.add(order.companyId)
      }
    }

    return {
      month: monthKey(monthStart),
      revenue: toCurrency(revenue),
      newRevenue: toCurrency(newRevenue),
      returningRevenue: toCurrency(returningRevenue),
      orders,
      newOrders,
      returningOrders,
      averageOrderValue: orders > 0 ? toCurrency(revenue / orders) : 0,
      activeCompanies: activeCompanies.size,
      newCompanies: newCompanies.size,
      reactivatedCompanies: reactivatedCompanies.size,
    }
  })

  return {
    monthlyRevenue: monthRows.map((row) => ({
      month: row.month,
      revenue: row.revenue,
      newRevenue: row.newRevenue,
      returningRevenue: row.returningRevenue,
    })),
    monthlyOrders: monthRows.map((row) => ({
      month: row.month,
      orders: row.orders,
      newOrders: row.newOrders,
      returningOrders: row.returningOrders,
    })),
    monthlyAov: monthRows.map((row) => ({ month: row.month, averageOrderValue: row.averageOrderValue })),
    monthlyActiveCompanies: monthRows.map((row) => ({
      month: row.month,
      activeCompanies: row.activeCompanies,
      newCompanies: row.newCompanies,
      reactivatedCompanies: row.reactivatedCompanies,
    })),
    notEnoughData: periodOrders.length === 0,
  }
}

export async function getCompanyBehaviour(filters: ExecutiveFilters) {
  const { rollups, periodOrders, allOrdersToEnd } = await loadCompanyGraph(filters)
  const lapsedCompanyIds = rollups.filter((row) => row.status === 'lapsed').map((row) => row.companyId)
  const recoveryActions =
    lapsedCompanyIds.length > 0
      ? await prisma.companyRecoveryAction
          .findMany({
            where: { companyId: { in: lapsedCompanyIds } },
            orderBy: { createdAt: 'desc' },
            select: {
              companyId: true,
              actionLabel: true,
              note: true,
              createdAt: true,
            },
          })
          .catch(() => [])
      : []
  const recoveryActionsByCompany = new Map<
    string,
    Array<{ actionLabel: string; note: string | null; createdAt: Date }>
  >()
  for (const action of recoveryActions) {
    const list = recoveryActionsByCompany.get(action.companyId) || []
    list.push({
      actionLabel: action.actionLabel,
      note: action.note || null,
      createdAt: action.createdAt,
    })
    recoveryActionsByCompany.set(action.companyId, list)
  }
  const totalRevenue = periodOrders.reduce((sum, order) => sum + order.orderTotal, 0)

  const frequencyBuckets = [
    { id: '1', label: '1 order', match: (v: number) => v === 1 },
    { id: '2_3', label: '2-3 orders', match: (v: number) => v >= 2 && v <= 3 },
    { id: '4_9', label: '4-9 orders', match: (v: number) => v >= 4 && v <= 9 },
    { id: '10_plus', label: '10+ orders', match: (v: number) => v >= 10 },
  ].map((bucket) => {
    const members = rollups.filter((row) => bucket.match(row.lifetimeOrders))
    const revenue = members.reduce((sum, row) => sum + row.periodRevenue, 0)
    return {
      bucket: bucket.label,
      companies: members.length,
      revenue: toCurrency(revenue),
      averageCompanyRevenue: members.length > 0 ? toCurrency(revenue / members.length) : 0,
      revenuePct: totalRevenue > 0 ? toCurrency((revenue / totalRevenue) * 100) : 0,
    }
  })

  const revenueByOrderNumber = computeRevenueByCompanyOrderNumber(allOrdersToEnd, filters.startDate, filters.endDate)
    .map((row) => ({
      ...row,
      revenue: toCurrency(row.revenue),
      averageOrderValue: toCurrency(row.averageOrderValue),
      revenuePct: totalRevenue > 0 ? toCurrency((row.revenue / totalRevenue) * 100) : 0,
    }))

  const valueSegmentation = [
    { label: '<$500', match: (v: number) => v < 500 },
    { label: '$500-$1,999', match: (v: number) => v >= 500 && v < 2000 },
    { label: '$2,000-$4,999', match: (v: number) => v >= 2000 && v < 5000 },
    { label: '$5,000-$9,999', match: (v: number) => v >= 5000 && v < 10000 },
    { label: '$10,000+', match: (v: number) => v >= 10000 },
  ].map((bucket) => {
    const members = rollups.filter((row) => bucket.match(row.lifetimeRevenue))
    const revenue = members.reduce((sum, row) => sum + row.periodRevenue, 0)
    const orders = members.reduce((sum, row) => sum + row.periodOrders, 0)
    return {
      bucket: bucket.label,
      companies: members.length,
      revenue: toCurrency(revenue),
      orders,
      averageOrdersPerCompany: members.length > 0 ? toCurrency(orders / members.length) : 0,
    }
  })

  const orderGap = (() => {
    const byCompany = groupOrdersByCompany(allOrdersToEnd)
    const buckets: Record<string, number[]> = {
      '1st_to_2nd': [],
      '2nd_to_3rd': [],
      '3rd_to_4th': [],
      '4th_plus': [],
    }
    for (const orders of byCompany.values()) {
      for (let i = 1; i < orders.length; i++) {
        const days = diffDays(orders[i - 1].orderDate, orders[i].orderDate)
        if (i === 1) buckets['1st_to_2nd'].push(days)
        else if (i === 2) buckets['2nd_to_3rd'].push(days)
        else if (i === 3) buckets['3rd_to_4th'].push(days)
        else buckets['4th_plus'].push(days)
      }
    }
    return {
      firstToSecond: toCurrency(avg(buckets['1st_to_2nd'])),
      secondToThird: toCurrency(avg(buckets['2nd_to_3rd'])),
      thirdToFourth: toCurrency(avg(buckets['3rd_to_4th'])),
      fourthPlus: toCurrency(avg(buckets['4th_plus'])),
    }
  })()

  const lapsedCompanies = rollups
    .filter((row) => row.status === 'lapsed')
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 25)
    .map((row) => {
      const companyActions = (recoveryActionsByCompany.get(row.companyId) || []).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
      const firstRecoveryActionAt = companyActions.at(-1)?.createdAt || null
      const rollupKey = row.rollupKey || row.companyId
      const postRecoveryOrders = firstRecoveryActionAt
        ? allOrdersToEnd.filter(
            (order) =>
              order.companyId === rollupKey &&
              order.orderDate > firstRecoveryActionAt &&
              Number(order.orderTotal || 0) > 0
          )
        : []
      const postRecoveryRevenue = toCurrency(
        postRecoveryOrders.reduce((sum, order) => sum + Number(order.orderTotal || 0), 0)
      )
      return {
        latestRecoveryAction: companyActions[0]?.actionLabel || null,
        latestRecoveryAt: companyActions[0]?.createdAt.toISOString() || null,
        recoveryActions: companyActions.map((action) => ({
          actionLabel: action.actionLabel,
          note: action.note,
          createdAt: action.createdAt.toISOString(),
        })),
        recovered: postRecoveryRevenue > 0,
        postRecoveryRevenue,
        companyId: row.companyId,
        companyName: row.companyName,
        lifetimeRevenue: toCurrency(row.lifetimeRevenue),
        lifetimeOrders: row.lifetimeOrders,
        daysSinceLastOrder: row.daysSinceLastOrder,
        suggestedApproach: recommendedAction(row),
        estimatedRecoveryValue: toCurrency(row.avgOrderValue),
        lastOrderDate: row.lastOrderDate ? row.lastOrderDate.toISOString() : null,
      }
    })

  return {
    frequencyDistribution: frequencyBuckets,
    revenueByOrderNumber,
    valueSegmentation,
    timeBetweenOrders: orderGap,
    lapsedCompanies,
    notEnoughData: rollups.length === 0,
  }
}

export function computeRevenueByCompanyOrderNumber(
  allOrdersToEnd: CompanyOrderRow[],
  startDate: Date,
  endDate: Date
): OrderNumberBucketRow[] {
  const orderNumberMap = new Map<string, { revenue: number; orders: number }>()
  for (const orders of groupOrdersByCompany(allOrdersToEnd).values()) {
    orders.forEach((order, index) => {
      if (!inRange(order.orderDate, startDate, endDate)) return
      const bucket =
        index === 0 ? '1st order' : index === 1 ? '2nd order' : index === 2 ? '3rd order' : '4th+ order'
      const current = orderNumberMap.get(bucket) || { revenue: 0, orders: 0 }
      current.revenue += order.orderTotal
      current.orders += 1
      orderNumberMap.set(bucket, current)
    })
  }
  return ['1st order', '2nd order', '3rd order', '4th+ order'].map((bucket) => {
    const current = orderNumberMap.get(bucket) || { revenue: 0, orders: 0 }
    return {
      bucket: bucket as OrderNumberBucketRow['bucket'],
      revenue: current.revenue,
      orders: current.orders,
      averageOrderValue: current.orders > 0 ? current.revenue / current.orders : 0,
      revenuePct: 0,
    }
  })
}

function groupOrdersByCompany(orders: CompanyOrderRow[]): Map<string, CompanyOrderRow[]> {
  const byCompany = new Map<string, CompanyOrderRow[]>()
  for (const order of orders) {
    const list = byCompany.get(order.companyId) || []
    list.push(order)
    byCompany.set(order.companyId, list)
  }
  for (const list of byCompany.values()) {
    list.sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
  }
  return byCompany
}

export async function getCompaniesTable(filters: ExecutiveFilters) {
  const { rollups, allOrdersToEnd } = await loadCompanyGraph(filters)
  const companyIds = rollups.map((row) => row.companyId)
  let lastManualReviewsResolved: Array<{ newCompanyId: string | null; _max: { createdAt: Date | null } }> = []
  if (companyIds.length) {
    try {
      const rows = await prisma.companyAssignmentAudit.groupBy({
        by: ['newCompanyId'],
        where: { newCompanyId: { in: companyIds } },
        _max: { createdAt: true },
      })
      lastManualReviewsResolved = rows.map((row) => ({
        newCompanyId: row.newCompanyId || null,
        _max: { createdAt: row._max.createdAt || null },
      }))
    } catch {
      lastManualReviewsResolved = []
    }
  }
  const lastReviewByCompanyId = new Map(
    lastManualReviewsResolved.map((row) => [row.newCompanyId || '', row._max.createdAt || null])
  )

  const rows = rollups.map((row) => {
    const rollupKey = row.rollupKey || row.companyId
    const rollupOrders = allOrdersToEnd.filter((order) => order.companyId === rollupKey)
    const uniqueAddresses = new Set(
      rollupOrders.map((order) => JSON.stringify(order.deliveryAddress || {}))
    ).size
    const methodCounts = new Map<string, number>()
    for (const order of rollupOrders) {
      const method = String(order.matchMethod || '').toLowerCase()
      if (!method) continue
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1)
    }
    const matchMethodBreakdown = Array.from(methodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => `${method}:${count}`)
      .slice(0, 3)
      .join(', ')

    const qualityFlags: string[] = []
    if (row.contacts > 50) qualityFlags.push('high_contact_count')
    if (isPrivateUnmatchedCompanyName(row.companyName)) qualityFlags.push('generic_name')
    if (!row.primaryDomain) qualityFlags.push('no_business_domain')
    if (row.primaryDomain && isGenericEmailDomain(row.primaryDomain)) qualityFlags.push('generic_domain')
    if (row.lifetimeRevenue > 10000 && qualityFlags.includes('generic_name')) {
      qualityFlags.push('high_revenue_generic_name')
    }
    const recommendedActionLabel =
      qualityFlags.length > 0 ? 'Review company mapping' : recommendedAction(row)

    return {
    companyId: row.companyId,
    companyName: row.companyName,
    lifetimeRevenue: toCurrency(row.lifetimeRevenue),
    lifetimeOrders: row.lifetimeOrders,
    averageOrderValue: toCurrency(row.avgOrderValue),
    firstOrderDate: row.firstOrderDate ? row.firstOrderDate.toISOString() : null,
    lastOrderDate: row.lastOrderDate ? row.lastOrderDate.toISOString() : null,
    daysSinceLastOrder: row.daysSinceLastOrder,
    contacts: row.contacts,
    status: row.status,
    matchConfidence: row.confidenceScore,
    primaryDomain: row.primaryDomain,
    primaryAddress: row.primaryAddress,
      qualityFlag: qualityFlags.join(', ') || null,
      matchMethodBreakdown,
      uniqueAddresses,
      isGenericDomain: row.primaryDomain ? isGenericEmailDomain(row.primaryDomain) : false,
      lastManuallyReviewedDate: lastReviewByCompanyId.get(row.companyId)?.toISOString() || null,
      recommendedAction: recommendedActionLabel,
    }
  })

  const sortBy = filters.sortBy || 'lifetimeRevenue'
  const sorted = [...rows].sort((a, b) => {
    const cmp = compareValue((a as any)[sortBy], (b as any)[sortBy])
    return filters.sortDir === 'asc' ? cmp : -cmp
  })
  const total = sorted.length
  const start = (filters.page - 1) * filters.pageSize
  const paginated = sorted.slice(start, start + filters.pageSize)

  return {
    rows: paginated,
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
    notEnoughData: total === 0,
  }
}

export async function getGrowthOpportunities(filters: ExecutiveFilters) {
  const { rollups } = await loadCompanyGraph(filters)
  const rows = rollups
    .map((row) => {
      const opportunity = classifyGrowthOpportunity(row)

      return {
        companyId: row.companyId,
        companyName: row.companyName,
        lifetimeRevenue: toCurrency(row.lifetimeRevenue),
        lifetimeOrders: row.lifetimeOrders,
        averageOrderValue: toCurrency(row.avgOrderValue),
        contacts: row.contacts,
        lastOrderDate: row.lastOrderDate ? row.lastOrderDate.toISOString() : null,
        daysSinceLastOrder: row.daysSinceLastOrder,
        status: row.status,
        opportunityType: opportunity.opportunityType,
        estimatedRevenueUpside: toCurrency(opportunity.estimatedRevenueUpside),
        recommendedAction: opportunity.recommendedAction,
      }
    })
    .sort((a, b) => b.estimatedRevenueUpside - a.estimatedRevenueUpside)

  const total = rows.length
  const start = (filters.page - 1) * filters.pageSize
  return {
    rows: rows.slice(start, start + filters.pageSize),
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
    notEnoughData: total === 0,
  }
}
