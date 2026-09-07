import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { formatLocalDate, formatNZYMD, getTodayLocal } from '@/lib/date-utils'
import { getLifecycleSuggestions } from '@/lib/lifecycle/lifecycle-eligibility'

type QueueFilter = 'needs_review' | 'all' | 'completed' | 'skipped' | 'no_followup' | 'blocked' | 'sent'

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

function getYesterdayYmd() {
  const yesterday = new Date(getTodayLocal())
  yesterday.setDate(yesterday.getDate() - 1)
  return formatLocalDate(yesterday)
}

function defaultBlockedReason(input: {
  companyId?: string | null
  contactEmail?: string | null
  lifecyclePausedUntil?: Date | null
  lifecycleOptOut?: boolean | null
  globalOptOut?: boolean
}) {
  if (!input.companyId) return 'company_unmatched'
  if (!input.contactEmail) return 'missing_contact_email'
  if (input.lifecyclePausedUntil && new Date(input.lifecyclePausedUntil).getTime() > Date.now()) {
    return `lifecycle_paused_until_${new Date(input.lifecyclePausedUntil).toISOString().slice(0, 10)}`
  }
  if (input.lifecycleOptOut || input.globalOptOut) return 'opted_out'
  return null
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const rawFilter = String(request.nextUrl.searchParams.get('filter') || 'needs_review')
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit') || 30)))
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || 0))
    const filter: QueueFilter = (
      ['needs_review', 'all', 'completed', 'skipped', 'no_followup', 'blocked', 'sent'] as const
    ).includes(rawFilter as QueueFilter)
      ? (rawFilter as QueueFilter)
      : 'needs_review'

    const yesterdayYmd = getYesterdayYmd()
    const orders = await prisma.order.findMany({
      where: {
        cancelledAt: null,
        OR: [{ deliveryDate: yesterdayYmd }, { AND: [{ deliveryDate: null }, { deliveryDateResolved: { not: null } }] }],
      },
      select: {
        id: true,
        shopifyId: true,
        orderNumber: true,
        deliveryDate: true,
        deliveryDateResolved: true,
        deliveryTime: true,
        totalPrice: true,
        lineItems: true,
        customerEmail: true,
        customerFirstName: true,
        customerLastName: true,
        fulfillmentStatus: true,
      },
      orderBy: [{ orderNumber: 'desc' }],
      take: 300,
    })

    const yesterdayOrders = orders.filter((order) => {
      const ymd =
        (order.deliveryDate && String(order.deliveryDate)) ||
        (order.deliveryDateResolved ? formatNZYMD(new Date(order.deliveryDateResolved)) : null)
      return ymd === yesterdayYmd
    })
    if (!yesterdayOrders.length) {
      return NextResponse.json({
        success: true,
        date: yesterdayYmd,
        rows: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      })
    }

    const shopifyOrderIds = yesterdayOrders.map((order) => order.shopifyId).filter(Boolean)
    const orderIds = yesterdayOrders.map((order) => order.id)
    const customerEmails = Array.from(
      new Set(
        yesterdayOrders
          .map((order) => String(order.customerEmail || '').trim().toLowerCase())
          .filter(Boolean)
      )
    )
    const [companyOrders, suggestions, followups, optOutRows, customerOrderHistory, customerCommsLogs] =
      await Promise.all([
      (prisma as any).companyOrder.findMany({
        where: { shopifyOrderId: { in: shopifyOrderIds } },
        include: {
          company: {
            include: {
              contacts: {
                orderBy: [{ isPrimaryContact: 'desc' }, { totalSpend: 'desc' }],
                take: 5,
              },
            },
          },
        },
      }),
      getLifecycleSuggestions(2000),
      (prisma as any).postPurchaseFollowup.findMany({
        where: { orderId: { in: orderIds } },
      }),
      (prisma as any).orderNotificationOptOut.findMany({
        where: {
          email: {
            in: customerEmails,
          },
        },
        select: { email: true },
      }),
      customerEmails.length
        ? prisma.order.findMany({
            where: {
              cancelledAt: null,
              customerEmail: {
                in: customerEmails,
              },
            },
            select: {
              customerEmail: true,
              orderNumber: true,
              totalPrice: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          })
        : [],
      customerEmails.length
        ? (prisma as any).lifecycleEmailSendLog.findMany({
            where: {
              recipientEmail: {
                in: customerEmails,
              },
            },
            select: {
              recipientEmail: true,
              emailType: true,
              status: true,
              sentAt: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          })
        : [],
    ])

    const optOutSet = new Set((optOutRows || []).map((row: any) => String(row.email || '').toLowerCase()))
    const companyOrderByShopifyId = new Map<string, any>()
    for (const row of companyOrders) companyOrderByShopifyId.set(String(row.shopifyOrderId), row)
    const suggestionByCompanyId = new Map<string, any>()
    for (const row of suggestions) suggestionByCompanyId.set(String(row.companyId), row)
    const followupByOrderId = new Map<string, any>()
    for (const row of followups) followupByOrderId.set(String(row.orderId), row)

    for (const order of yesterdayOrders) {
      const existing = followupByOrderId.get(order.id)
      if (existing) continue
      const companyOrder = companyOrderByShopifyId.get(String(order.shopifyId))
      const company = companyOrder?.company || null
      const contact =
        company?.contacts?.find((c: any) => c.isPrimaryContact && c.email) ||
        company?.contacts?.find((c: any) => c.email) ||
        null
      const contactEmail = String(contact?.email || order.customerEmail || '').trim().toLowerCase()
      const blockedReason = defaultBlockedReason({
        companyId: company?.companyId,
        contactEmail,
        lifecyclePausedUntil: company?.lifecyclePausedUntil,
        lifecycleOptOut: contact?.lifecycleOptOut,
        globalOptOut: optOutSet.has(contactEmail),
      })
      const created = await (prisma as any).postPurchaseFollowup.create({
        data: {
          orderId: order.id,
          shopifyOrderId: order.shopifyId,
          companyId: company?.companyId || null,
          contactId: contact?.contactId || null,
          status: blockedReason ? 'blocked' : 'pending_review',
          blockedReason,
          lastActionAt: new Date(),
          lastActionBy: 'system',
        },
      })
      followupByOrderId.set(order.id, created)
    }

    const companyIds = Array.from(
      new Set(
        companyOrders
          .map((row: any) => String(row?.company?.companyId || ''))
          .filter(Boolean)
      )
    )
    const followupIds = Array.from(
      new Set(
        Array.from(followupByOrderId.values())
          .map((row: any) => String(row?.postPurchaseFollowupId || ''))
          .filter(Boolean)
      )
    )
    const l12Cutoff = new Date()
    l12Cutoff.setFullYear(l12Cutoff.getFullYear() - 1)

    const [companyOrderHistory, l12SpendRows, latestActions] = await Promise.all([
      companyIds.length
        ? (prisma as any).companyOrder.findMany({
            where: {
              companyId: {
                in: companyIds,
              },
            },
            select: {
              companyId: true,
              shopifyOrderId: true,
              orderDate: true,
              orderTotal: true,
            },
            orderBy: [{ orderDate: 'desc' }],
          })
        : [],
      companyIds.length
        ? (prisma as any).companyOrder.groupBy({
            by: ['companyId'],
            where: {
              companyId: {
                in: companyIds,
              },
              orderDate: {
                gte: l12Cutoff,
              },
            },
            _sum: {
              orderTotal: true,
            },
          })
        : [],
      followupIds.length
        ? (prisma as any).postPurchaseFollowupAction.findMany({
            where: {
              postPurchaseFollowupId: {
                in: followupIds,
              },
            },
            select: {
              postPurchaseFollowupId: true,
              actionType: true,
              actionStatus: true,
              actedAt: true,
            },
            orderBy: [{ actedAt: 'desc' }],
          })
        : [],
    ])
    const shopifyIdsForLookup = Array.from(
      new Set(
        (companyOrderHistory as any[])
          .map((row) => String(row.shopifyOrderId || ''))
          .filter(Boolean)
      )
    )
    const orderNumberRows = shopifyIdsForLookup.length
      ? await prisma.order.findMany({
          where: {
            shopifyId: {
              in: shopifyIdsForLookup,
            },
          },
          select: {
            shopifyId: true,
            orderNumber: true,
          },
        })
      : []
    const orderNumberByShopifyId = new Map<string, number>()
    for (const row of orderNumberRows) {
      orderNumberByShopifyId.set(String(row.shopifyId), Number(row.orderNumber || 0))
    }

    const lastFiveOrdersByCompany = new Map<
      string,
      Array<{
        orderId: string
        orderNumber: number
        orderDate: string | null
        orderValue: number
      }>
    >()
    for (const row of companyOrderHistory as any[]) {
      const companyId = String(row.companyId || '')
      if (!companyId) continue
      const existing = lastFiveOrdersByCompany.get(companyId) || []
      if (existing.length >= 5) continue
      existing.push({
        orderId: String(row.shopifyOrderId || ''),
        orderNumber: Number(orderNumberByShopifyId.get(String(row.shopifyOrderId || '')) || 0),
        orderDate: row.orderDate ? formatNZYMD(new Date(row.orderDate)) : null,
        orderValue: Number(row.orderTotal || 0),
      })
      lastFiveOrdersByCompany.set(companyId, existing)
    }

    const l12SpendByCompany = new Map<string, number>()
    for (const row of l12SpendRows as any[]) {
      l12SpendByCompany.set(String(row.companyId), Number(row?._sum?.orderTotal || 0))
    }

    const latestActionByFollowup = new Map<
      string,
      {
        actionType: string
        actionStatus: string
        actedAt: Date | null
      }
    >()
    for (const row of latestActions as any[]) {
      const followupId = String(row.postPurchaseFollowupId || '')
      if (!followupId || latestActionByFollowup.has(followupId)) continue
      latestActionByFollowup.set(followupId, {
        actionType: String(row.actionType || ''),
        actionStatus: String(row.actionStatus || ''),
        actedAt: row.actedAt || null,
      })
    }

    const customerStatsByEmail = new Map<
      string,
      {
        orderCount: number
        ltv: number
        l12v: number
        lastFiveOrders: Array<{
          orderNumber: number
          orderDate: string | null
          orderValue: number
        }>
      }
    >()
    for (const row of customerOrderHistory as any[]) {
      const email = String(row.customerEmail || '').trim().toLowerCase()
      if (!email) continue
      const existing = customerStatsByEmail.get(email) || {
        orderCount: 0,
        ltv: 0,
        l12v: 0,
        lastFiveOrders: [],
      }
      const orderValue = Number(row.totalPrice || 0)
      existing.orderCount += 1
      existing.ltv += orderValue
      if (row.createdAt && new Date(row.createdAt).getTime() >= l12Cutoff.getTime()) {
        existing.l12v += orderValue
      }
      if (existing.lastFiveOrders.length < 5) {
        existing.lastFiveOrders.push({
          orderNumber: Number(row.orderNumber || 0),
          orderDate: row.createdAt ? formatNZYMD(new Date(row.createdAt)) : null,
          orderValue,
        })
      }
      customerStatsByEmail.set(email, existing)
    }

    const customerLastCorrespondenceByEmail = new Map<
      string,
      {
        correspondenceType: string | null
        correspondenceStatus: string | null
        correspondenceAt: Date | null
      }
    >()
    for (const row of customerCommsLogs as any[]) {
      const email = String(row.recipientEmail || '').trim().toLowerCase()
      if (!email || customerLastCorrespondenceByEmail.has(email)) continue
      customerLastCorrespondenceByEmail.set(email, {
        correspondenceType: String(row.emailType || '').trim() || null,
        correspondenceStatus: String(row.status || '').trim() || null,
        correspondenceAt: row.sentAt || row.createdAt || null,
      })
    }

    let rows = yesterdayOrders.map((order) => {
      const companyOrder = companyOrderByShopifyId.get(String(order.shopifyId))
      const company = companyOrder?.company || null
      const contact =
        company?.contacts?.find((c: any) => c.isPrimaryContact && c.email) ||
        company?.contacts?.find((c: any) => c.email) ||
        null
      const suggestion = company ? suggestionByCompanyId.get(String(company.companyId)) : null
      const followup = followupByOrderId.get(order.id)
      const productsList = extractLineItems(order.lineItems).slice(0, 6)
      const deliveryDate =
        (order.deliveryDate && String(order.deliveryDate)) ||
        (order.deliveryDateResolved ? formatNZYMD(new Date(order.deliveryDateResolved)) : null)
      const companyId = company?.companyId ? String(company.companyId) : null
      const latestAction = followup?.postPurchaseFollowupId
        ? latestActionByFollowup.get(String(followup.postPurchaseFollowupId))
        : null
      const customerEmail = String(order.customerEmail || '').trim().toLowerCase()
      const customerStats = customerStatsByEmail.get(customerEmail) || {
        orderCount: 0,
        ltv: 0,
        l12v: 0,
        lastFiveOrders: [],
      }
      const customerLastCorrespondence = customerLastCorrespondenceByEmail.get(customerEmail) || null

      return {
        rowId: order.id,
        orderId: order.shopifyId,
        orderNumber: order.orderNumber,
        orderName: `#${order.orderNumber}`,
        customerName: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ').trim(),
        customerEmail: order.customerEmail,
        customerOrderCount: customerStats.orderCount,
        customerLtv: customerStats.ltv,
        customerL12v: customerStats.l12v,
        customerLastFiveOrders: customerStats.lastFiveOrders,
        customerLastCorrespondenceType: customerLastCorrespondence?.correspondenceType || null,
        customerLastCorrespondenceStatus: customerLastCorrespondence?.correspondenceStatus || null,
        customerLastCorrespondenceAt: customerLastCorrespondence?.correspondenceAt || null,
        companyId,
        companyName: company?.canonicalCompanyName || 'Unmatched company',
        deliveryDate,
        deliveryTime: order.deliveryTime || null,
        orderValue: Number(order.totalPrice || 0),
        productsList,
        productsSummary: productsList.join(', '),
        companyOrderCount: Number(company?.totalOrders || 0),
        companyLtv: Number(company?.totalRevenue || 0),
        companyL12v: companyId ? Number(l12SpendByCompany.get(companyId) || 0) : 0,
        lastFiveOrders: companyId ? lastFiveOrdersByCompany.get(companyId) || [] : [],
        lastCorrespondenceType: latestAction?.actionType || null,
        lastCorrespondenceStatus: latestAction?.actionStatus || null,
        lastCorrespondenceAt: latestAction?.actedAt || null,
        isFirstTimeCompany: Number(company?.totalOrders || 0) <= 1,
        strategicScore: suggestion?.strategicScore || 0,
        strategicStatus: company?.isStrategicOverride ? 'manual_strategic' : suggestion?.strategicScore >= 60 ? 'strategic_candidate' : 'standard',
        rewardCatalogId: suggestion?.rewardCatalogId || null,
        rewardName: suggestion?.rewardName || null,
        suggestedEmailType: suggestion?.suggestedEmailType || 'FIRST_ORDER_POST_PURCHASE',
        suggestedAction: suggestion?.suggestedNextAction || 'Post-purchase follow-up',
        selectedEmailType: followup?.selectedEmailType || null,
        selectedRewardCatalogId: followup?.selectedRewardCatalogId || null,
        selectedRewardIssueId: followup?.selectedRewardIssueId || null,
        selectedVoucherTemplateId: followup?.selectedVoucherTemplateId || null,
        postPurchaseStatus: followup?.status || 'pending_review',
        blockedReason: followup?.blockedReason || null,
        contactId: contact?.contactId || null,
        fulfillmentStatus: order.fulfillmentStatus || null,
        lifecycleStage: suggestion?.lifecycleStage || null,
        followupUpdatedAt: followup?.updatedAt || null,
      }
    })

    if (filter === 'needs_review') {
      rows = rows.filter((row) => ['pending_review', 'previewed', 'test_sent'].includes(String(row.postPurchaseStatus)))
    } else if (filter === 'completed') {
      rows = rows.filter((row) => ['completed', 'sent', 'skipped', 'no_followup'].includes(String(row.postPurchaseStatus)))
    } else if (filter === 'skipped') {
      rows = rows.filter((row) => String(row.postPurchaseStatus) === 'skipped')
    } else if (filter === 'no_followup') {
      rows = rows.filter((row) => String(row.postPurchaseStatus) === 'no_followup')
    } else if (filter === 'blocked') {
      rows = rows.filter((row) => String(row.postPurchaseStatus) === 'blocked')
    } else if (filter === 'sent') {
      rows = rows.filter((row) => String(row.postPurchaseStatus) === 'sent')
    }

    const total = rows.length
    const pagedRows = rows.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      date: yesterdayYmd,
      rows: pagedRows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load post-purchase queue' }, { status: error?.status || 500 })
  }
}

