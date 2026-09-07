import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractEmailRootDomain, isGenericEmailDomain } from '@/lib/company-matching'

function companyFromAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const company = (value as Record<string, unknown>).company
  return typeof company === 'string' ? company.trim() : ''
}

export async function GET() {
  try {
    const [totalShopifyOrders, mappedOrders, pendingReviews, privateCompany] = await Promise.all([
      prisma.order.count({ where: { source: 'shopify' } }),
      prisma.companyOrder.count(),
      prisma.companyMatchReview.count({ where: { status: 'pending' } }),
      prisma.company.findFirst({
        where: { canonicalCompanyName: 'Private Customer' },
        select: { companyId: true },
      }),
    ])

    const orders = await prisma.order.findMany({
      where: { source: 'shopify' },
      select: {
        shopifyId: true,
        customerEmail: true,
        shippingAddress: true,
        billingAddress: true,
      },
    })

    const eligiblePrivateIds: string[] = []
    for (const order of orders) {
      const domain = extractEmailRootDomain(order.customerEmail)
      const isGeneric = isGenericEmailDomain(domain)
      const shippingCompany = companyFromAddress(order.shippingAddress)
      const billingCompany = companyFromAddress(order.billingAddress)
      if (isGeneric && !shippingCompany && !billingCompany) {
        eligiblePrivateIds.push(order.shopifyId)
      }
    }

    let privateAssigned = 0
    if (privateCompany) {
      const privateOrders = await prisma.companyOrder.findMany({
        where: { companyId: privateCompany.companyId },
        select: { shopifyOrderId: true },
      })
      const privateOrderSet = new Set(privateOrders.map((row) => row.shopifyOrderId))
      privateAssigned = eligiblePrivateIds.reduce(
        (count, shopifyId) => count + (privateOrderSet.has(shopifyId) ? 1 : 0),
        0
      )
    }

    const [companyMetrics, customerMetrics] = await Promise.all([
      prisma.companyMetricsMonthly.aggregate({
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      prisma.customerMetricsMonthly.aggregate({
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ])

    const step1Pct = totalShopifyOrders > 0 ? (mappedOrders / totalShopifyOrders) * 100 : 0
    const step2Pct =
      eligiblePrivateIds.length > 0 ? (privateAssigned / eligiblePrivateIds.length) * 100 : 100

    return NextResponse.json({
      success: true,
      progress: {
        step1: {
          label: 'Domain/company parsing',
          processed: mappedOrders,
          total: totalShopifyOrders,
          pct: Number(step1Pct.toFixed(2)),
        },
        step2: {
          label: 'Private customer assignment',
          processed: privateAssigned,
          total: eligiblePrivateIds.length,
          pct: Number(step2Pct.toFixed(2)),
        },
        step3: {
          label: 'Metrics refresh',
          companyRows: companyMetrics._count._all,
          customerRows: customerMetrics._count._all,
          companyLastUpdatedAt: companyMetrics._max.updatedAt?.toISOString() || null,
          customerLastUpdatedAt: customerMetrics._max.updatedAt?.toISOString() || null,
        },
      },
      pendingReviews,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load company normalization status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
