import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { companyStatusFromDates, diffDays, toCurrency } from '@/lib/dashboard/common'
import { extractEmailRootDomain } from '@/lib/company-matching'

function toMethodLabel(method: string): string {
  return String(method || '').toLowerCase()
}

function toOrderNumber(payload: Record<string, any>): string {
  return String(payload?.name || payload?.order_number || payload?.id || '')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    await requireRole(['owner', 'admin'])
    const { companyId } = await params

    const company = await prisma.company.findUnique({
      where: { companyId },
      select: {
        companyId: true,
        canonicalCompanyName: true,
        primaryDomain: true,
        alternateDomains: true,
        primaryAddress: true,
        confidenceScore: true,
        contacts: {
          select: {
            contactId: true,
            companyId: true,
            shopifyCustomerId: true,
            firstName: true,
            lastName: true,
            email: true,
            totalOrders: true,
            totalSpend: true,
            firstOrderDate: true,
            lastOrderDate: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const orders = await prisma.companyOrder.findMany({
      where: { companyId },
      select: {
        companyOrderId: true,
        shopifyOrderId: true,
        shopifyCustomerId: true,
        orderDate: true,
        orderTotal: true,
        deliveryAddress: true,
        billingAddress: true,
        matchMethod: true,
        confidenceScore: true,
        matchReason: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { orderDate: 'desc' },
    })

    const rawOrders = await prisma.rawShopifyOrder.findMany({
      where: {
        shopifyOrderId: { in: orders.map((order) => order.shopifyOrderId) },
      },
      select: {
        shopifyOrderId: true,
        payload: true,
      },
    })
    const rawByOrderId = new Map(rawOrders.map((row) => [row.shopifyOrderId, row.payload as Record<string, any>]))

    const uniqueByShopifyOrder = new Map<string, { orderTotal: number; orderDate: Date }>()
    for (const order of orders) {
      uniqueByShopifyOrder.set(order.shopifyOrderId, {
        orderTotal: Number(order.orderTotal || 0),
        orderDate: order.orderDate,
      })
    }
    const uniqueRows = Array.from(uniqueByShopifyOrder.values()).sort(
      (a, b) => a.orderDate.getTime() - b.orderDate.getTime()
    )
    const lifetimeRevenue = toCurrency(uniqueRows.reduce((sum, row) => sum + row.orderTotal, 0))
    const lifetimeOrders = uniqueRows.length
    const firstOrderDate = uniqueRows[0]?.orderDate || null
    const lastOrderDate = uniqueRows.at(-1)?.orderDate || null
    const aov = lifetimeOrders > 0 ? toCurrency(lifetimeRevenue / lifetimeOrders) : 0
    const hadOrderInPeriod = !!lastOrderDate
    const status = companyStatusFromDates(
      firstOrderDate,
      lastOrderDate,
      new Date(),
      hadOrderInPeriod,
      null
    )
    const daysSinceLastOrder = lastOrderDate ? diffDays(lastOrderDate, new Date()) : null
    const uniqueAddresses = new Set(
      orders.map((row) => JSON.stringify(row.deliveryAddress || row.billingAddress || {}))
    ).size

    const matchMethodBreakdownMap = new Map<string, number>()
    for (const order of orders) {
      const key = toMethodLabel(String(order.matchMethod))
      matchMethodBreakdownMap.set(key, (matchMethodBreakdownMap.get(key) || 0) + 1)
    }
    const matchMethodBreakdown = Array.from(matchMethodBreakdownMap.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)

    const contacts = company.contacts.map((contact) => {
      const relatedOrders = orders.filter((order) => {
        if (contact.shopifyCustomerId && order.shopifyCustomerId === contact.shopifyCustomerId) return true
        const payload = rawByOrderId.get(order.shopifyOrderId)
        const email = String(payload?.customer?.email || '').toLowerCase()
        return !!contact.email && email === contact.email.toLowerCase()
      })
      const orderIds = new Set(relatedOrders.map((row) => row.shopifyOrderId))
      const revenue = toCurrency(relatedOrders.reduce((sum, row) => sum + Number(row.orderTotal || 0), 0))
      const methods = new Map<string, number>()
      for (const row of relatedOrders) {
        const key = toMethodLabel(String(row.matchMethod))
        methods.set(key, (methods.get(key) || 0) + 1)
      }
      const topMethod = Array.from(methods.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
      const averageConfidence =
        relatedOrders.length > 0
          ? toCurrency(
              relatedOrders.reduce((sum, row) => sum + Number(row.confidenceScore || 0), 0) / relatedOrders.length
            )
          : 0

      const topReason = relatedOrders[0]?.matchReason || null
      const samplePayload = relatedOrders.length ? rawByOrderId.get(relatedOrders[0].shopifyOrderId) : null
      return {
        contactId: contact.contactId,
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '(Unknown)',
        email: contact.email,
        emailDomain: extractEmailRootDomain(contact.email),
        shopifyCustomerId: contact.shopifyCustomerId,
        totalRevenue: revenue,
        totalOrders: orderIds.size,
        firstOrderDate: contact.firstOrderDate?.toISOString() || null,
        lastOrderDate: contact.lastOrderDate?.toISOString() || null,
        matchMethod: topMethod,
        matchConfidence: averageConfidence,
        matchReason: topReason,
        sourceFields: {
          emailDomain: extractEmailRootDomain(contact.email),
          billingCompany: samplePayload?.billing_address?.company || null,
          shippingCompany: samplePayload?.shipping_address?.company || null,
          billingAddress: samplePayload?.billing_address || null,
          shippingAddress: samplePayload?.shipping_address || null,
        },
      }
    })

    const orderRows = orders.map((order) => {
      const payload = rawByOrderId.get(order.shopifyOrderId)
      const email = String(payload?.customer?.email || '').toLowerCase() || null
      const contact = contacts.find((entry) => entry.email?.toLowerCase() === email)
      return {
        companyOrderId: order.companyOrderId,
        orderNumber: toOrderNumber(payload || {}),
        shopifyOrderId: order.shopifyOrderId,
        shopifyCustomerId: order.shopifyCustomerId,
        customerContact: contact?.contactName || '(Unknown)',
        email: email || null,
        orderDate: order.orderDate.toISOString(),
        orderTotal: toCurrency(Number(order.orderTotal || 0)),
        deliveryAddress: order.deliveryAddress,
        billingCompany: payload?.billing_address?.company || null,
        shippingCompany: payload?.shipping_address?.company || null,
        matchMethod: toMethodLabel(String(order.matchMethod)),
        matchConfidence: order.confidenceScore,
        matchReason: order.matchReason,
        assignedCompanyId: company.companyId,
        rawPayload: payload || null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      }
    })

    const auditRows = await prisma.companyAssignmentAudit.findMany({
      where: {
        OR: [
          { oldCompanyId: companyId },
          { newCompanyId: companyId },
          {
            shopifyOrderId: {
              in: orders.map((row) => row.shopifyOrderId),
            },
          },
          {
            shopifyCustomerId: {
              in: company.contacts
                .map((contact) => contact.shopifyCustomerId)
                .filter((value): value is string => !!value),
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    const recoveryActions = await prisma.companyRecoveryAction
      .findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      .catch(() => [])

    return NextResponse.json({
      summary: {
        companyId: company.companyId,
        canonicalCompanyName: company.canonicalCompanyName,
        primaryDomain: company.primaryDomain,
        alternateDomains: company.alternateDomains,
        primaryAddress: company.primaryAddress,
        lifetimeRevenue,
        lifetimeOrders,
        averageOrderValue: aov,
        firstOrderDate: firstOrderDate?.toISOString() || null,
        lastOrderDate: lastOrderDate?.toISOString() || null,
        daysSinceLastOrder,
        contactsCount: contacts.length,
        matchConfidence: company.confidenceScore,
        matchMethodBreakdown,
        status,
        uniqueAddresses,
      },
      contacts,
      orders: orderRows,
      auditTrail: auditRows.map((row) => ({
        auditId: row.auditId,
        actionType: row.actionType,
        oldCompanyId: row.oldCompanyId,
        newCompanyId: row.newCompanyId,
        shopifyCustomerId: row.shopifyCustomerId,
        shopifyOrderId: row.shopifyOrderId,
        oldValue: row.oldValue,
        newValue: row.newValue,
        reason: row.reason,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      })),
      recoveryActions: recoveryActions.map((row) => ({
        recoveryActionId: row.recoveryActionId,
        actionLabel: row.actionLabel,
        note: row.note,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load company detail' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
