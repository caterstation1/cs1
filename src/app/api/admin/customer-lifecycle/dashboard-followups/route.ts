import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate, formatNZYMD } from '@/lib/date-utils'
import { getLifecycleSuggestions } from '@/lib/lifecycle/lifecycle-eligibility'
import type { LifecycleEmailType } from '@/lib/lifecycle/constants'

type FollowupFilter = 'all' | 'needs-follow-up' | 'first-time' | 'strategic' | 'already-sent-skipped'

const OPT_OUT_STATUSES = new Set(['skipped_manual', 'no_follow_up_needed'])

function extractLineItems(lineItems: any): string[] {
  let items: any[] = []
  if (Array.isArray(lineItems)) {
    items = lineItems
  } else if (typeof lineItems === 'string') {
    try {
      items = JSON.parse(lineItems)
    } catch {
      items = []
    }
  }
  return items
    .map((item: any) => String(item?.title || item?.name || '').trim())
    .filter(Boolean)
}

function strategicScoreFor(input: {
  firstOrderValue: number
  domain?: string | null
  name?: string | null
  totalSpend: number
}): number {
  let score = 0
  if (input.firstOrderValue >= 600) score += 40
  if (input.totalSpend >= 1000) score += 15
  const domain = String(input.domain || '').toLowerCase()
  if (domain && !/(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|icloud\.com|xtra\.co\.nz)/.test(domain)) score += 20
  const name = String(input.name || '').toLowerCase()
  if (/(law|finance|agency|tech|real estate|construction|school|college|office|limited|ltd|group)/.test(name)) score += 15
  return Math.min(100, score)
}

function suggestedEmailTypeFor(input: {
  companyOrderCount: number
  strategicScore: number
  hasSecondOrder: boolean
}): LifecycleEmailType {
  if (!input.hasSecondOrder && input.companyOrderCount <= 1 && input.strategicScore >= 60) {
    return 'STRATEGIC_SECOND_ORDER_VOUCHER'
  }
  if (input.companyOrderCount <= 1) return 'FIRST_ORDER_POST_PURCHASE'
  return 'REPEAT_ORDER_POST_PURCHASE'
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const rawFilter = String(request.nextUrl.searchParams.get('filter') || 'all')
    const filter = (['all', 'needs-follow-up', 'first-time', 'strategic', 'already-sent-skipped'] as const).includes(
      rawFilter as FollowupFilter
    )
      ? (rawFilter as FollowupFilter)
      : 'all'

    const yesterday = new Date(getTodayLocal())
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayYmd = formatLocalDate(yesterday)
    const orders = await prisma.order.findMany({
      where: {
        cancelledAt: null,
        OR: [
          { deliveryDate: yesterdayYmd },
          {
            AND: [{ deliveryDate: null }, { deliveryDateResolved: { not: null } }],
          },
        ],
      },
      select: {
        id: true,
        shopifyId: true,
        orderNumber: true,
        createdAt: true,
        deliveryDate: true,
        deliveryDateResolved: true,
        deliveryTime: true,
        totalPrice: true,
        lineItems: true,
        customerEmail: true,
        customerFirstName: true,
        customerLastName: true,
        shippingAddress: true,
      },
      orderBy: [{ orderNumber: 'desc' }],
      take: 300,
    })

    const shopifyOrderIds = orders.map((order) => order.shopifyId).filter(Boolean)
    const [companyOrders, suggestions] = await Promise.all([
      (prisma as any).companyOrder.findMany({
        where: { shopifyOrderId: { in: shopifyOrderIds } },
        include: {
          company: {
            include: {
              contacts: {
                orderBy: [{ isPrimaryContact: 'desc' }, { totalSpend: 'desc' }],
                take: 5,
              },
              companyOrders: {
                orderBy: [{ orderDate: 'asc' }],
                take: 1,
              },
            },
          },
        },
      }),
      getLifecycleSuggestions(2000),
    ])

    const companyOrderByShopifyId = new Map<string, any>()
    for (const row of companyOrders) {
      companyOrderByShopifyId.set(String(row.shopifyOrderId), row)
    }
    const suggestionByCompanyId = new Map<string, any>()
    for (const row of suggestions) {
      suggestionByCompanyId.set(String(row.companyId), row)
    }

    const companyIds = Array.from(
      new Set(
        companyOrders
          .map((row: any) => String(row.companyId || '').trim())
          .filter(Boolean)
      )
    )
    const primaryEmails = Array.from(
      new Set(
        orders
          .map((order) => String(order.customerEmail || '').trim().toLowerCase())
          .filter(Boolean)
      )
    )

    const [optOutRows, logs] = await Promise.all([
      primaryEmails.length
        ? (prisma as any).orderNotificationOptOut.findMany({
            where: { email: { in: primaryEmails } },
            select: { email: true },
          })
        : [],
      companyIds.length
        ? (prisma as any).lifecycleEmailSendLog.findMany({
            where: { companyId: { in: companyIds } },
            orderBy: [{ createdAt: 'desc' }],
            take: 5000,
          })
        : [],
    ])
    const optOutSet = new Set((optOutRows || []).map((row: any) => String(row.email || '').toLowerCase()))
    const latestLogByCompanyType = new Map<string, any>()
    for (const row of logs || []) {
      const key = `${row.companyId}:${row.emailType}`
      if (!latestLogByCompanyType.has(key)) {
        latestLogByCompanyType.set(key, row)
      }
    }

    let rows = orders.map((order) => {
      const companyOrder = companyOrderByShopifyId.get(String(order.shopifyId))
      const company = companyOrder?.company || null
      const contact =
        company?.contacts?.find((c: any) => c.isPrimaryContact && c.email) ||
        company?.contacts?.find((c: any) => c.email) ||
        null
      const companyOrderCount = Number(company?.totalOrders || 0)
      const totalSpend = Number(company?.totalRevenue || 0)
      const firstOrderValue = Number(company?.companyOrders?.[0]?.orderTotal || 0)
      const strategicScore = strategicScoreFor({
        firstOrderValue,
        domain: company?.primaryDomain,
        name: company?.canonicalCompanyName,
        totalSpend,
      })
      const suggestedEmailType = suggestedEmailTypeFor({
        companyOrderCount,
        strategicScore,
        hasSecondOrder: companyOrderCount > 1,
      })
      const companySuggestion = company ? suggestionByCompanyId.get(String(company.companyId)) : null
      const rewardCatalogId = companySuggestion?.rewardCatalogId || null
      const rewardName = companySuggestion?.rewardName || null
      const logKey = company ? `${company.companyId}:${suggestedEmailType}` : ''
      const latestLog = logKey ? latestLogByCompanyType.get(logKey) : null

      const contactEmail = String(contact?.email || order.customerEmail || '').trim().toLowerCase()
      let blockedReason: string | null = null
      if (!company) blockedReason = 'company_unmatched'
      else if (!contactEmail) blockedReason = 'missing_contact_email'
      else if (company.lifecyclePausedUntil && new Date(company.lifecyclePausedUntil).getTime() > Date.now()) {
        blockedReason = `lifecycle_paused_until_${new Date(company.lifecyclePausedUntil).toISOString().slice(0, 10)}`
      } else if (contact?.lifecycleOptOut || optOutSet.has(contactEmail)) {
        blockedReason = 'opted_out'
      }

      const lineTitles = extractLineItems(order.lineItems)
      const productsList = lineTitles.slice(0, 6)
      const productsSummary =
        productsList.length > 0
          ? productsList.join(', ')
          : '-'
      const deliveryDateYmd =
        (order.deliveryDate && String(order.deliveryDate)) ||
        (order.deliveryDateResolved ? formatNZYMD(new Date(order.deliveryDateResolved)) : null)

      return {
        rowId: order.id,
        orderId: order.shopifyId,
        orderNumber: order.orderNumber,
        orderName: `#${order.orderNumber}`,
        customerName: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim(),
        customerEmail: order.customerEmail,
        companyId: company?.companyId || null,
        companyName: company?.canonicalCompanyName || 'Unmatched company',
        deliveryDate: deliveryDateYmd,
        deliveryTime: order.deliveryTime || null,
        orderValue: Number(order.totalPrice || 0),
        productsSummary: productsSummary || '-',
        productsList,
        companyOrderCount,
        isFirstTimeCompany: companyOrderCount <= 1,
        strategicScore,
        strategicStatus: company?.isStrategicOverride
          ? 'manual_strategic'
          : strategicScore >= 60
          ? 'strategic_candidate'
          : 'standard',
        rewardCatalogId,
        rewardName,
        suggestedEmailType,
        suggestedAction:
          companyOrderCount <= 1
            ? strategicScore >= 60
              ? 'Strategic second-order voucher follow-up'
              : 'First-order post-purchase follow-up'
            : 'Repeat-order post-purchase follow-up',
        blockedReason,
        emailStatus: latestLog?.status || null,
        emailStatusReason: latestLog?.reason || null,
        emailStatusAt: latestLog?.createdAt || null,
        contactId: contact?.contactId || null,
      }
    })

    rows = rows.filter((row) => row.deliveryDate === yesterdayYmd)

    if (filter === 'needs-follow-up') {
      rows = rows.filter((row) => !row.blockedReason && !['sent', ...OPT_OUT_STATUSES].includes(String(row.emailStatus || '')))
    } else if (filter === 'first-time') {
      rows = rows.filter((row) => row.isFirstTimeCompany)
    } else if (filter === 'strategic') {
      rows = rows.filter((row) => row.strategicStatus !== 'standard')
    } else if (filter === 'already-sent-skipped') {
      rows = rows.filter((row) => ['sent', ...OPT_OUT_STATUSES].includes(String(row.emailStatus || '')))
    }

    return NextResponse.json({
      success: true,
      date: yesterdayYmd,
      count: rows.length,
      rows,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load dashboard follow-ups' },
      { status: error?.status || 500 }
    )
  }
}
