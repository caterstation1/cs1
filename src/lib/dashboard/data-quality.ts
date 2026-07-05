import { prisma } from '@/lib/prisma'
import { ExecutiveFilters } from './executive-filters'
import { extractEmailRootDomain, isGenericEmailDomain, normalizeCompanyName } from '@/lib/company-matching'
import { toCurrency } from './common'
import { getGenericDomainsSet } from '@/lib/company-normalization-admin'

function businessDomainFromCompany(company: {
  primaryDomain: string | null
  alternateDomains: string[]
}): string | null {
  const domains = [company.primaryDomain, ...(company.alternateDomains || [])]
  for (const domain of domains) {
    if (!domain) continue
    const root = extractEmailRootDomain(`noreply@${domain}`) || domain.toLowerCase()
    if (!isGenericEmailDomain(root)) return root
  }
  return null
}

function toMethodBucket(params: {
  rawMethod: string
  companyName: string
  domain: string | null
}): string {
  const method = params.rawMethod.toUpperCase()
  if (method === 'DOMAIN_EXACT' || method === 'DOMAIN_AND_ADDRESS') return 'domain_exact'
  if (method === 'NAME_EXACT' || method === 'NAME_AND_ADDRESS') return 'company_name_exact'
  if (method === 'ADDRESS_EXACT') return 'address_exact'
  if (method === 'FUZZY') return 'fuzzy_reviewed'
  const normalizedCompany = params.companyName.trim().toLowerCase()
  if (normalizedCompany.startsWith('private customer')) return 'private_customer'
  if (!params.domain) return 'unmatched'
  return 'unmatched'
}

export async function getDataQualityMetrics(filters: ExecutiveFilters) {
  const [companies, pendingReviews, avgConfidence, companyOrdersRaw, rawOrders, genericDomainSet] = await Promise.all([
    prisma.company.findMany({
      select: {
        companyId: true,
        canonicalCompanyName: true,
        primaryDomain: true,
        alternateDomains: true,
        contacts: { select: { contactId: true } },
      },
    }),
    prisma.companyMatchReview.count({ where: { status: 'pending' } }),
    prisma.companyOrder.aggregate({
      _avg: { confidenceScore: true },
    }),
    prisma.companyOrder.findMany({
      where: {
        orderDate: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      select: {
        companyId: true,
        shopifyOrderId: true,
        shopifyCustomerId: true,
        orderDate: true,
        orderTotal: true,
        matchMethod: true,
        confidenceScore: true,
        deliveryAddress: true,
        company: {
          select: {
            canonicalCompanyName: true,
            primaryDomain: true,
            alternateDomains: true,
          },
        },
      },
    }),
    prisma.rawShopifyOrder.findMany({
      select: { shopifyOrderId: true, payload: true },
    }),
    getGenericDomainsSet(),
  ])

  const companyContacts = await prisma.companyContact.findMany({
    select: {
      companyId: true,
      email: true,
    },
  })

  const companyMetaById = new Map(
    companies.map((company) => [
      company.companyId,
      {
        ...company,
        businessDomain: businessDomainFromCompany(company),
      },
    ])
  )
  const contactEmailsByCompanyId = new Map<string, string[]>()
  for (const contact of companyContacts) {
    if (!contact.email) continue
    const existing = contactEmailsByCompanyId.get(contact.companyId) || []
    existing.push(contact.email.toLowerCase())
    contactEmailsByCompanyId.set(contact.companyId, existing)
  }

  const totalCompanies = companies.length
  const ordersAssignedToCompanies = companyOrdersRaw.length
  const matchedOrderIds = new Set(companyOrdersRaw.map((order) => order.shopifyOrderId))
  const ordersWithoutCompanyMatch = rawOrders.filter((order) => !matchedOrderIds.has(order.shopifyOrderId)).length

  let genericEmailOrders = 0
  const customerRevenueByDomain = new Map<string, number>()
  const customerOrderCountByDomain = new Map<string, number>()
  const orphanedBusinessDomainCustomers = new Map<
    string,
    { email: string; domain: string; orders: number; revenue: number }
  >()

  for (const order of rawOrders) {
    const payload = (order.payload || {}) as Record<string, any>
    const createdAt = new Date(payload.created_at || payload.processed_at || Date.now())
    if (createdAt < filters.startDate || createdAt > filters.endDate) continue
    const email = String(payload?.customer?.email || '').trim().toLowerCase()
    const rootDomain = extractEmailRootDomain(email)
    const isGeneric = isGenericEmailDomain(rootDomain)
    if (isGeneric) genericEmailOrders += 1
    if (!rootDomain || isGeneric) continue
    const orderRevenue = Number(payload.current_total_price || payload.total_price || payload.totalPrice || 0)
    customerRevenueByDomain.set(rootDomain, (customerRevenueByDomain.get(rootDomain) || 0) + orderRevenue)
    customerOrderCountByDomain.set(rootDomain, (customerOrderCountByDomain.get(rootDomain) || 0) + 1)

    const assigned = companyOrdersRaw.find((co) => co.shopifyOrderId === order.shopifyOrderId)
    const assignedDomain = assigned
      ? businessDomainFromCompany({
          primaryDomain: assigned.company.primaryDomain,
          alternateDomains: assigned.company.alternateDomains,
        })
      : null
    if (!assigned || assignedDomain !== rootDomain) {
      const key = email || `${rootDomain}:${payload?.customer?.id || 'unknown'}`
      const existing = orphanedBusinessDomainCustomers.get(key) || {
        email: email || '(missing email)',
        domain: rootDomain,
        orders: 0,
        revenue: 0,
      }
      existing.orders += 1
      existing.revenue += orderRevenue
      orphanedBusinessDomainCustomers.set(key, existing)
    }
  }

  const companyRevenueByDomain = new Map<string, number>()
  const companyOrdersByDomain = new Map<string, number>()
  const matchMethodCounts = new Map<string, number>()
  const companyAggByDomain = new Map<
    string,
    {
      companyName: string
      domain: string
      revenue: number
      orders: number
      firstOrder: Date | null
      lastOrder: Date | null
      contacts: Set<string>
      matchMethods: Map<string, number>
      confidenceTotal: number
      confidenceCount: number
    }
  >()

  for (const order of companyOrdersRaw) {
    const domain = businessDomainFromCompany({
      primaryDomain: order.company.primaryDomain,
      alternateDomains: order.company.alternateDomains,
    })
    const methodBucket = toMethodBucket({
      rawMethod: String(order.matchMethod),
      companyName: order.company.canonicalCompanyName,
      domain,
    })
    matchMethodCounts.set(methodBucket, (matchMethodCounts.get(methodBucket) || 0) + 1)
    if (!domain) continue
    const revenue = Number(order.orderTotal || 0)
    companyRevenueByDomain.set(domain, (companyRevenueByDomain.get(domain) || 0) + revenue)
    companyOrdersByDomain.set(domain, (companyOrdersByDomain.get(domain) || 0) + 1)

    const current = companyAggByDomain.get(domain) || {
      companyName: order.company.canonicalCompanyName,
      domain,
      revenue: 0,
      orders: 0,
      firstOrder: null as Date | null,
      lastOrder: null as Date | null,
      contacts: new Set<string>(),
      matchMethods: new Map<string, number>(),
      confidenceTotal: 0,
      confidenceCount: 0,
    }
    current.revenue += revenue
    current.orders += 1
    current.firstOrder =
      !current.firstOrder || order.orderDate < current.firstOrder ? order.orderDate : current.firstOrder
    current.lastOrder = !current.lastOrder || order.orderDate > current.lastOrder ? order.orderDate : current.lastOrder
    current.matchMethods.set(methodBucket, (current.matchMethods.get(methodBucket) || 0) + 1)
    current.confidenceTotal += Number(order.confidenceScore || 0)
    current.confidenceCount += 1
    const companyEmails = contactEmailsByCompanyId.get(order.companyId) || []
    for (const email of companyEmails) {
      if ((extractEmailRootDomain(email) || '') === domain) current.contacts.add(email)
    }
    companyAggByDomain.set(domain, current)
  }

  const reconciliationRows = Array.from(customerRevenueByDomain.entries())
    .map(([domain, customerRevenue]) => {
      const companyRevenue = companyRevenueByDomain.get(domain) || 0
      return {
        domain,
        customerRevenueByDomain: toCurrency(customerRevenue),
        companyRevenueForDomain: toCurrency(companyRevenue),
        difference: toCurrency(customerRevenue - companyRevenue),
      }
    })
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))

  const topMismatchDomains = reconciliationRows
    .filter((row) => Math.abs(row.difference) > 1)
    .slice(0, 25)

  const duplicates = await prisma.company.findMany({
    select: {
      canonicalCompanyName: true,
    },
  })
  const normalizedCounts = new Map<string, number>()
  for (const company of duplicates) {
    const key = normalizeCompanyName(company.canonicalCompanyName)
    normalizedCounts.set(key, (normalizedCounts.get(key) || 0) + 1)
  }
  const duplicateCompanyCandidates = Array.from(normalizedCounts.values()).filter((count) => count > 1).length

  const duplicateOrderGroups = new Map<string, Set<string>>()
  for (const order of companyOrdersRaw) {
    const set = duplicateOrderGroups.get(order.shopifyOrderId) || new Set<string>()
    set.add(order.companyId)
    duplicateOrderGroups.set(order.shopifyOrderId, set)
  }
  const multiAssignedOrders = Array.from(duplicateOrderGroups.values()).filter((set) => set.size > 1).length

  const topCompaniesByRevenue = Array.from(companyAggByDomain.values())
    .map((row) => {
      const topMethod =
        Array.from(row.matchMethods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unmatched'
      return {
        company: row.companyName,
        domain: row.domain,
        lifetimeCompanyRevenue: toCurrency(row.revenue),
        lifetimeCompanyOrders: row.orders,
        contacts: row.contacts.size,
        topContactEmails: Array.from(row.contacts).slice(0, 3),
        firstOrder: row.firstOrder ? row.firstOrder.toISOString() : null,
        lastOrder: row.lastOrder ? row.lastOrder.toISOString() : null,
        matchMethod: topMethod,
        confidence:
          row.confidenceCount > 0 ? toCurrency(row.confidenceTotal / row.confidenceCount) : 0,
      }
    })
    .sort((a, b) => b.lifetimeCompanyRevenue - a.lifetimeCompanyRevenue)
    .slice(0, 25)

  const ordersByCompanyId = new Map<string, Array<{ orderTotal: number; deliveryAddress: unknown; matchMethod: string }>>()
  for (const order of companyOrdersRaw) {
    const list = ordersByCompanyId.get(order.companyId) || []
    list.push({
      orderTotal: Number(order.orderTotal || 0),
      deliveryAddress: order.deliveryAddress || null,
      matchMethod: String(order.matchMethod),
    })
    ordersByCompanyId.set(order.companyId, list)
  }
  const companyQualityFlags = companies
    .map((company) => {
      const normalizedName = normalizeCompanyName(company.canonicalCompanyName)
      const genericNameSet = new Set(['school', 'unknown', 'net', 'hotmail', 'yahoo', 'xtra'])
      const hasGenericName = genericNameSet.has(normalizedName)
      const domain = businessDomainFromCompany(company)
      const isGenericDomain = !!company.primaryDomain && genericDomainSet.has(company.primaryDomain.toLowerCase())
      const companyOrders = ordersByCompanyId.get(company.companyId) || []
      const revenue = companyOrders.reduce((sum, row) => sum + row.orderTotal, 0)
      const uniqueAddresses = new Set(companyOrders.map((row) => JSON.stringify(row.deliveryAddress || {}))).size
      const methodCounts = new Map<string, number>()
      for (const row of companyOrders) {
        methodCounts.set(row.matchMethod, (methodCounts.get(row.matchMethod) || 0) + 1)
      }
      const manualLike = (methodCounts.get('MANUAL_OVERRIDE') || 0) + (methodCounts.get('FUZZY') || 0)
      const qualityFlags: string[] = []
      if ((company.contacts?.length || 0) > 50) qualityFlags.push('contacts_over_50')
      if (isGenericDomain) qualityFlags.push('generic_domain')
      if (hasGenericName) qualityFlags.push('generic_name')
      if (revenue > 10000 && hasGenericName) qualityFlags.push('high_revenue_generic_name')
      if (!domain && revenue > 10000) qualityFlags.push('high_revenue_no_business_domain')
      if (manualLike > companyOrders.length * 0.6 && companyOrders.length > 0) {
        qualityFlags.push('mostly_manual_or_private')
      }
      if (uniqueAddresses > 12) qualityFlags.push('many_unrelated_addresses')
      return {
        companyId: company.companyId,
        companyName: company.canonicalCompanyName,
        qualityFlags,
      }
    })
    .filter((row) => row.qualityFlags.length > 0)
    .slice(0, 100)

  return {
    totalCompanies,
    ordersAssignedToCompanies,
    ordersWithoutCompanyMatch,
    matchesByMethod: Array.from(matchMethodCounts.entries()).map(([method, count]) => ({
      method,
      count,
    })),
    averageMatchConfidence: toCurrency(Number(avgConfidence._avg.confidenceScore || 0)),
    matchesPendingReview: pendingReviews,
    genericEmailOrders,
    duplicateCompanyCandidates,
    reconciliation: {
      rows: reconciliationRows.slice(0, 100),
      topMismatchDomains,
    },
    orphanedBusinessDomainCustomers: Array.from(orphanedBusinessDomainCustomers.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50)
      .map((row) => ({
        email: row.email,
        domain: row.domain,
        orders: row.orders,
        revenue: toCurrency(row.revenue),
      })),
    companyOrderDuplicateCheck: {
      totalCompanyOrders: companyOrdersRaw.length,
      distinctShopifyOrderIds: duplicateOrderGroups.size,
      multiAssignedOrders,
    },
    topCompaniesByRevenue,
    companyQualityFlags,
    linkToReviewQueue: '/admin/company-matches',
    notEnoughData: totalCompanies === 0,
  }
}
