import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { matchCompany } from './matcher'
import { normalizeAddress, normalizeCompanyName } from './normalization'
import type { CompanyIdentityInput, CompanyMatchResult, CompanyRecordCandidate } from './types'
import { getGenericDomainsSet } from '@/lib/company-normalization-admin'

function toPrismaMatchMethod(method: CompanyMatchResult['method']) {
  switch (method) {
    case 'domain_exact':
      return 'DOMAIN_EXACT'
    case 'name_exact':
      return 'NAME_EXACT'
    case 'name_and_address':
      return 'NAME_AND_ADDRESS'
    case 'domain_and_address':
      return 'DOMAIN_AND_ADDRESS'
    case 'address_exact':
      return 'ADDRESS_EXACT'
    case 'fuzzy_reviewed':
      return 'FUZZY'
    case 'private_customer':
      return 'MANUAL_OVERRIDE'
    case 'unmatched':
      return 'MANUAL_OVERRIDE'
    case 'new_company':
      return 'MANUAL_OVERRIDE'
    default:
      return 'MANUAL_OVERRIDE'
  }
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractAddressDetails(address: unknown): {
  city?: string | null
  region?: string | null
  country?: string | null
} {
  if (!address || typeof address !== 'object') return {}
  const entry = address as Record<string, unknown>
  return {
    city: typeof entry.city === 'string' ? entry.city : null,
    region: typeof entry.province === 'string' ? entry.province : null,
    country: typeof entry.country === 'string' ? entry.country : null,
  }
}

function mergeUnique(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const value of values) {
    if (!value) continue
    const trimmed = value.trim()
    if (!trimmed) continue
    out.add(trimmed)
  }
  return Array.from(out)
}

async function ensureCompanyFromMatch(
  tx: Prisma.TransactionClient,
  match: CompanyMatchResult,
  identity: CompanyIdentityInput
): Promise<string> {
  if (match.method === 'private_customer' || match.method === 'unmatched') {
    const contactEmail = identity.email?.trim().toLowerCase() || null
    if (contactEmail) {
      const existingContact = await tx.companyContact.findFirst({
        where: { email: contactEmail },
        select: { companyId: true },
      })
      if (existingContact) return existingContact.companyId
    }
    if (identity.shopifyCustomerId) {
      const existingCustomerContact = await tx.companyContact.findFirst({
        where: { shopifyCustomerId: identity.shopifyCustomerId },
        select: { companyId: true },
      })
      if (existingCustomerContact) return existingCustomerContact.companyId
    }
  }

  if (match.domain) {
    const sameDomainCompanies = await tx.company.findMany({
      where: {
        OR: [
          { primaryDomain: match.domain },
          { alternateDomains: { has: match.domain } },
        ],
      },
      orderBy: [{ totalRevenue: 'desc' }, { createdAt: 'asc' }],
      select: {
        companyId: true,
        canonicalCompanyName: true,
        companyNameVariants: true,
        primaryDomain: true,
        alternateDomains: true,
        primaryAddress: true,
        city: true,
        region: true,
        country: true,
        confidenceScore: true,
      },
    })
    if (sameDomainCompanies.length > 0) {
      const canonicalDomainCompany = sameDomainCompanies[0]
      const variants = mergeUnique([
        ...canonicalDomainCompany.companyNameVariants,
        match.proposedCompanyName,
        titleCase(match.normalizedCompanyName || normalizeCompanyName(match.proposedCompanyName)),
      ])
      const domains = mergeUnique([...(canonicalDomainCompany.alternateDomains || []), match.domain || null])
      await tx.company.update({
        where: { companyId: canonicalDomainCompany.companyId },
        data: {
          companyNameVariants: variants,
          alternateDomains: domains,
          primaryDomain: canonicalDomainCompany.primaryDomain || match.domain,
          confidenceScore: Math.max(canonicalDomainCompany.confidenceScore, match.confidenceScore),
        },
      })
      return canonicalDomainCompany.companyId
    }
  }

  const address = identity.shippingAddress ?? identity.billingAddress ?? null
  const details = extractAddressDetails(address)
  const canonical = titleCase(match.normalizedCompanyName || normalizeCompanyName(match.proposedCompanyName))

  if (match.matchedCompanyId && (!match.requiresManualReview || match.confidenceScore >= 80)) {
    const existing = await tx.company.findUnique({ where: { companyId: match.matchedCompanyId } })
    if (existing) {
      const variants = mergeUnique([
        ...existing.companyNameVariants,
        match.proposedCompanyName,
        canonical,
      ])
      const domains = mergeUnique([...(existing.alternateDomains || []), match.domain || null])
      await tx.company.update({
        where: { companyId: existing.companyId },
        data: {
          companyNameVariants: variants,
          alternateDomains: domains,
          primaryDomain: existing.primaryDomain || match.domain || null,
          primaryAddress: existing.primaryAddress ?? address ?? undefined,
          city: existing.city || details.city || null,
          region: existing.region || details.region || null,
          country: existing.country || details.country || null,
          confidenceScore: Math.max(existing.confidenceScore, match.confidenceScore),
        },
      })
      return existing.companyId
    }
  }

  const created = await tx.company.create({
    data: {
      canonicalCompanyName:
        match.method === 'private_customer' && identity.email
          ? `Private Customer (${identity.email.toLowerCase()})`
          : canonical || titleCase(match.proposedCompanyName || 'Unknown Company'),
      companyNameVariants: mergeUnique([match.proposedCompanyName, canonical]),
      primaryDomain: match.domain || null,
      alternateDomains: match.domain ? [match.domain] : [],
      primaryAddress: address as Prisma.InputJsonValue,
      city: details.city || null,
      region: details.region || null,
      country: details.country || null,
      confidenceScore: match.confidenceScore,
    },
  })
  return created.companyId
}

async function refreshCompanyAggregates(tx: Prisma.TransactionClient, companyId: string) {
  const [aggregate, minMax] = await Promise.all([
    tx.companyOrder.aggregate({
      where: { companyId },
      _count: { _all: true },
      _sum: { orderTotal: true },
    }),
    tx.companyOrder.aggregate({
      where: { companyId },
      _min: { orderDate: true },
      _max: { orderDate: true },
    }),
  ])

  await tx.company.update({
    where: { companyId },
    data: {
      totalOrders: aggregate._count._all || 0,
      totalRevenue: aggregate._sum.orderTotal || 0,
      firstOrderDate: minMax._min.orderDate || null,
      lastOrderDate: minMax._max.orderDate || null,
    },
  })
}

function toCompanyCandidateRows(rows: Array<{
  companyId: string
  canonicalCompanyName: string
  companyNameVariants: string[]
  primaryDomain: string | null
  alternateDomains: string[]
  primaryAddress: Prisma.JsonValue | null
  city: string | null
  region: string | null
  country: string | null
}>): CompanyRecordCandidate[] {
  return rows.map((row) => ({
    companyId: row.companyId,
    canonicalCompanyName: row.canonicalCompanyName,
    companyNameVariants: row.companyNameVariants || [],
    primaryDomain: row.primaryDomain,
    alternateDomains: row.alternateDomains || [],
    primaryAddress: row.primaryAddress,
    city: row.city,
    region: row.region,
    country: row.country,
  }))
}

export async function parseAndUpsertCompanyForOrder(params: {
  shopifyOrder: Record<string, any>
  transformedOrder: Record<string, any>
}) {
  const { shopifyOrder, transformedOrder } = params
  const shopifyOrderId = String(shopifyOrder?.id || transformedOrder?.shopifyId || '')
  if (!shopifyOrderId) return null

  const shopifyCustomerId = shopifyOrder?.customer?.id ? String(shopifyOrder.customer.id) : null
  const shippingCompany =
    transformedOrder?.shippingAddress?.company || shopifyOrder?.shipping_address?.company || null
  const billingCompany = shopifyOrder?.billing_address?.company || null
  const identity: CompanyIdentityInput = {
    shopifyOrderId,
    shopifyCustomerId,
    customerFirstName: transformedOrder?.customerFirstName || null,
    customerLastName: transformedOrder?.customerLastName || null,
    email: transformedOrder?.customerEmail || shopifyOrder?.customer?.email || null,
    phone: transformedOrder?.customerPhone || null,
    shippingCompany,
    billingCompany,
    shippingAddress: transformedOrder?.shippingAddress || shopifyOrder?.shipping_address || null,
    billingAddress: shopifyOrder?.billing_address || null,
    orderNote: transformedOrder?.notes || shopifyOrder?.note || null,
    customerTags: Array.isArray(shopifyOrder?.customer?.tags)
      ? shopifyOrder.customer.tags
      : typeof shopifyOrder?.customer?.tags === 'string'
        ? shopifyOrder.customer.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
        : [],
  }

  const existingCompanies = await prisma.company.findMany({
    select: {
      companyId: true,
      canonicalCompanyName: true,
      companyNameVariants: true,
      primaryDomain: true,
      alternateDomains: true,
      primaryAddress: true,
      city: true,
      region: true,
      country: true,
    },
  })
  const genericDomains = await getGenericDomainsSet()
  const match = matchCompany(identity, toCompanyCandidateRows(existingCompanies), { genericDomains })

  return prisma.$transaction(async (tx) => {
    await tx.rawShopifyOrder.upsert({
      where: { shopifyOrderId },
      create: {
        shopifyOrderId,
        shopifyOrderName: shopifyOrder?.name ? String(shopifyOrder.name) : null,
        payload: shopifyOrder as Prisma.InputJsonValue,
      },
      update: {
        shopifyOrderName: shopifyOrder?.name ? String(shopifyOrder.name) : null,
        payload: shopifyOrder as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    })

    if (shopifyCustomerId && shopifyOrder?.customer) {
      await tx.rawShopifyCustomer.upsert({
        where: { shopifyCustomerId },
        create: {
          shopifyCustomerId,
          email: identity.email || null,
          payload: shopifyOrder.customer as Prisma.InputJsonValue,
        },
        update: {
          email: identity.email || null,
          payload: shopifyOrder.customer as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
      })
    }

    const companyId = await ensureCompanyFromMatch(tx, match, identity)
    const orderDate = transformedOrder?.createdAt ? new Date(transformedOrder.createdAt) : new Date()

    await tx.companyOrder.upsert({
      where: { shopifyOrderId },
      create: {
        companyId,
        shopifyOrderId,
        shopifyCustomerId,
        orderDate,
        orderTotal: Number(transformedOrder?.totalPrice || 0),
        orderSubtotal: Number(transformedOrder?.subtotalPrice || 0),
        discounts: Number(shopifyOrder?.total_discounts || 0),
        refunds: Number(shopifyOrder?.current_total_duties_set?.shop_money?.amount || 0),
        products: (transformedOrder?.lineItems || []) as Prisma.InputJsonValue,
        deliveryAddress: (transformedOrder?.shippingAddress || null) as Prisma.InputJsonValue,
        billingAddress: (shopifyOrder?.billing_address || null) as Prisma.InputJsonValue,
        sourceChannel: shopifyOrder?.source_name || transformedOrder?.source || null,
        matchMethod: toPrismaMatchMethod(match.method),
        confidenceScore: match.confidenceScore,
        matchReason: match.matchReason,
      },
      update: {
        companyId,
        shopifyCustomerId,
        orderDate,
        orderTotal: Number(transformedOrder?.totalPrice || 0),
        orderSubtotal: Number(transformedOrder?.subtotalPrice || 0),
        discounts: Number(shopifyOrder?.total_discounts || 0),
        refunds: Number(shopifyOrder?.current_total_duties_set?.shop_money?.amount || 0),
        products: (transformedOrder?.lineItems || []) as Prisma.InputJsonValue,
        deliveryAddress: (transformedOrder?.shippingAddress || null) as Prisma.InputJsonValue,
        billingAddress: (shopifyOrder?.billing_address || null) as Prisma.InputJsonValue,
        sourceChannel: shopifyOrder?.source_name || transformedOrder?.source || null,
        matchMethod: toPrismaMatchMethod(match.method),
        confidenceScore: match.confidenceScore,
        matchReason: match.matchReason,
      },
    })

    if (identity.email) {
      await tx.companyContact.upsert({
        where: {
          companyId_email: {
            companyId,
            email: identity.email,
          },
        },
        create: {
          companyId,
          shopifyCustomerId,
          firstName: identity.customerFirstName || null,
          lastName: identity.customerLastName || null,
          email: identity.email,
          phone: identity.phone || null,
          firstOrderDate: orderDate,
          lastOrderDate: orderDate,
          totalOrders: 1,
          totalSpend: Number(transformedOrder?.totalPrice || 0),
        },
        update: {
          shopifyCustomerId,
          firstName: identity.customerFirstName || null,
          lastName: identity.customerLastName || null,
          phone: identity.phone || null,
          lastOrderDate: orderDate,
        },
      })
    }

    if (match.confidenceScore < 80) {
      await tx.companyMatchReview.create({
        data: {
          proposedCompanyId: companyId,
          proposedCompanyName: titleCase(match.normalizedCompanyName || match.proposedCompanyName),
          existingCompanyId: match.matchedCompanyId || null,
          existingCompanyName: match.matchedCompanyId
            ? existingCompanies.find((company) => company.companyId === match.matchedCompanyId)?.canonicalCompanyName || null
            : null,
          matchReason: match.matchReason,
          confidenceScore: match.confidenceScore,
          orderIds: [shopifyOrderId],
          status: 'pending',
        },
      })
    }

    await refreshCompanyAggregates(tx, companyId)

    if (identity.email) {
      const contactAgg = await tx.companyOrder.aggregate({
        where: { companyId, shopifyCustomerId: shopifyCustomerId || undefined },
        _count: { _all: true },
        _sum: { orderTotal: true },
        _min: { orderDate: true },
        _max: { orderDate: true },
      })
      await tx.companyContact.updateMany({
        where: {
          companyId,
          email: identity.email,
        },
        data: {
          totalOrders: contactAgg._count._all || 0,
          totalSpend: contactAgg._sum.orderTotal || 0,
          firstOrderDate: contactAgg._min.orderDate || null,
          lastOrderDate: contactAgg._max.orderDate || null,
        },
      })
    }

    return { companyId, match }
  })
}
