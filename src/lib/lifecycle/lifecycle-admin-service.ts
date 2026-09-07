import { prisma } from '@/lib/prisma'
import { LifecycleEmailType } from './constants'
import { getLifecycleSuggestions } from './lifecycle-eligibility'
import { ensureLifecycleCommsSettings, normalizeLifecycleSettings } from './lifecycle-comms-service'

export async function getLifecycleSummary() {
  const [companies, suggestions, sentLogs, rewardIssues] = await Promise.all([
    (prisma as any).company.findMany({
      select: { companyId: true, totalOrders: true, totalRevenue: true, lastOrderDate: true, isVipOverride: true },
      take: 2000,
    }),
    getLifecycleSuggestions(1000),
    (prisma as any).lifecycleEmailSendLog.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
    (prisma as any).rewardIssue.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    }),
  ])

  const now = Date.now()
  const atRisk = companies.filter((c: any) => {
    if (!c.lastOrderDate) return false
    const days = Math.floor((now - new Date(c.lastOrderDate).getTime()) / (24 * 60 * 60 * 1000))
    return days >= 45
  }).length
  const vipCount = companies.filter((c: any) => c.isVipOverride || c.totalRevenue >= 5000).length
  const awaitingSecond = suggestions.filter((s) => s.orderCount <= 1).length
  const strategicFirst = suggestions.filter((s) => s.orderCount === 1 && s.strategicScore >= 60).length
  const rewardsIssued = rewardIssues.filter((r: any) => ['issued', 'sent', 'redeemed'].includes(r.status)).length
  const rewardsRedeemed = rewardIssues.filter((r: any) => r.status === 'redeemed').length

  return {
    awaitingSecond,
    strategicFirst,
    rewardsIssued,
    rewardsRedeemed,
    atRisk,
    vipCount,
    recentSends: sentLogs,
  }
}

export async function getLifecycleCompanies(limit = 500) {
  return getLifecycleSuggestions(limit)
}

export async function buildCandidateFromSuggestion(input: {
  companyId: string
  contactId?: string | null
  orderId?: string | null
  emailType: LifecycleEmailType
  rewardIssueId?: string | null
  rewardCatalogId?: string | null
  subject?: string
  bodyCopy?: string
}) {
  const listProductTitles = (lineItems: any): string => {
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
      .slice(0, 6)
      .join(', ')
  }

  const company = await (prisma as any).company.findUnique({
    where: { companyId: input.companyId },
    include: {
      contacts: true,
      companyOrders: {
        orderBy: [{ orderDate: 'desc' }],
        take: 1,
      },
    },
  })
  if (!company) throw new Error('Company not found')

  const contact =
    (input.contactId
      ? company.contacts.find((c: any) => c.contactId === input.contactId)
      : company.contacts.find((c: any) => c.isPrimaryContact && c.email) || company.contacts.find((c: any) => c.email)) || null
  if (!contact?.email) throw new Error('Contact email not found')

  let rewardIssue = null
  if (input.rewardIssueId) {
    rewardIssue = await (prisma as any).rewardIssue.findUnique({
      where: { rewardIssueId: input.rewardIssueId },
      include: { rewardCatalog: true },
    })
  }

  let selectedCompanyOrder = company.companyOrders?.[0] || null
  let selectedOrder: any = null
  if (input.orderId) {
    const [companyOrderMatch, orderMatch] = await Promise.all([
      (prisma as any).companyOrder.findFirst({
        where: {
          companyId: company.companyId,
          shopifyOrderId: input.orderId,
        },
      }),
      (prisma as any).order.findUnique({
        where: { shopifyId: input.orderId },
      }),
    ])
    if (companyOrderMatch) selectedCompanyOrder = companyOrderMatch
    if (orderMatch) selectedOrder = orderMatch
  } else {
    selectedOrder = await (prisma as any).order.findUnique({
      where: { shopifyId: selectedCompanyOrder?.shopifyOrderId || '' },
    }).catch(() => null)
  }

  const resolvedOrderId = selectedCompanyOrder?.shopifyOrderId || input.orderId || null
  const orderNumber = selectedOrder?.orderNumber || selectedCompanyOrder?.shopifyOrderId || ''
  const orderName = selectedOrder?.orderNumber ? `#${selectedOrder.orderNumber}` : selectedCompanyOrder?.shopifyOrderId || ''
  const productsOrdered = listProductTitles(selectedOrder?.lineItems)
  const orderDateValue = selectedCompanyOrder?.orderDate || selectedOrder?.createdAt || null
  const deliveryDateValue = selectedOrder?.deliveryDateResolved || selectedOrder?.deliveryDate || null
  const settings = normalizeLifecycleSettings(await ensureLifecycleCommsSettings())
  const reviewUrl = String(settings.rewardRuleConfig?.reviewUrl || '').trim()
  const feedbackUrl = String(settings.rewardRuleConfig?.feedbackUrl || '').trim()
  const reorderUrl = String(settings.rewardRuleConfig?.reorderUrl || '').trim()

  return {
    companyId: company.companyId,
    contactId: contact.contactId,
    orderId: resolvedOrderId,
    rewardIssueId: rewardIssue?.rewardIssueId || null,
    emailType: input.emailType,
    recipientEmail: contact.email,
    customerFirstName: contact.firstName || 'there',
    companyName: company.canonicalCompanyName,
    orderName,
    orderNumber,
    orderDate: orderDateValue ? new Date(orderDateValue).toISOString().slice(0, 10) : undefined,
    deliveryDate: deliveryDateValue ? new Date(deliveryDateValue).toISOString().slice(0, 10) : undefined,
    productsOrdered,
    totalSpend: Number(company.totalRevenue || 0),
    companyOrderCount: Number(company.totalOrders || 0),
    rewardName: rewardIssue?.rewardCatalog?.rewardName || null,
    rewardCode: rewardIssue?.code || null,
    rewardExpiryDate: rewardIssue?.expiryDate
      ? new Date(rewardIssue.expiryDate).toISOString().slice(0, 10)
      : undefined,
    reviewUrl: reviewUrl || undefined,
    feedbackUrl: feedbackUrl || undefined,
    reorderUrl: reorderUrl || undefined,
    subject: input.subject,
    bodyCopy: input.bodyCopy,
  }
}
