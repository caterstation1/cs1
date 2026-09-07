import { prisma } from '@/lib/prisma'
import { formatNZYMD } from '@/lib/date-utils'
import { LifecycleEmailType } from './constants'
import { listRewardCatalog } from './reward-catalog-service'

export type LifecycleSuggestion = {
  suggestionId: string
  companyId: string
  companyName: string
  contactId?: string | null
  contactName?: string | null
  contactEmail?: string | null
  firstOrderDate?: string | null
  lastOrderDate?: string | null
  orderCount: number
  totalSpend: number
  daysSinceLastOrder: number
  strategicScore: number
  lifecycleStage: 'NEW' | 'AWAITING_SECOND_ORDER' | 'ACTIVE' | 'VIP' | 'AT_RISK' | 'LOST'
  suggestedEmailType: LifecycleEmailType
  suggestedNextAction: string
  rewardCatalogId?: string | null
  rewardName?: string | null
  rewardReason?: string | null
}

function daysSince(date: Date | null | undefined): number {
  if (!date) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000)))
}

function lifecycleStage(days: number, orders: number, spend: number): LifecycleSuggestion['lifecycleStage'] {
  if (spend >= 5000 || orders >= 15) return 'VIP'
  if (orders <= 1) return 'AWAITING_SECOND_ORDER'
  if (days >= 90) return 'LOST'
  if (days >= 45) return 'AT_RISK'
  if (orders === 1) return 'NEW'
  return 'ACTIVE'
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

function emailTypeFor(stage: LifecycleSuggestion['lifecycleStage'], orders: number): LifecycleEmailType {
  if (stage === 'VIP') return 'VIP'
  if (stage === 'LOST') return 'REACTIVATION'
  if (stage === 'AT_RISK') return 'REACTIVATION'
  if (orders <= 1) return 'SECOND_ORDER_INCENTIVE'
  return 'REPEAT_ORDER_POST_PURCHASE'
}

export async function getLifecycleSuggestions(limit = 500): Promise<LifecycleSuggestion[]> {
  const [companies, rewardCatalog, rewardIssues] = await Promise.all([
    (prisma as any).company.findMany({
      include: {
        contacts: {
          orderBy: [{ isPrimaryContact: 'desc' }, { totalSpend: 'desc' }, { createdAt: 'asc' }],
          take: 5,
        },
        companyOrders: {
          orderBy: [{ orderDate: 'asc' }],
          take: 5,
        },
      },
      take: limit,
      orderBy: [{ lastOrderDate: 'desc' }],
    }),
    listRewardCatalog(),
    (prisma as any).rewardIssue.findMany({
      where: { sourceRuleKey: 'spend_milestone' },
      select: {
        companyId: true,
        issuedAt: true,
      },
    }),
  ])

  const milestoneReward = rewardCatalog.find((r: any) =>
    String(r.rewardName || '').toLowerCase().includes('milestone')
  )
  const firstOrderReward = rewardCatalog.find((r: any) =>
    String(r.rewardName || '').toLowerCase().includes('tater')
  )
  const strategicReward = rewardCatalog.find((r: any) =>
    String(r.rewardName || '').includes('$100')
  )

  const suggestions: LifecycleSuggestion[] = []
  const milestoneIssueMeta = new Map<string, { count: number; lastIssuedAt: Date | null }>()
  for (const row of rewardIssues) {
    const current = milestoneIssueMeta.get(row.companyId) || { count: 0, lastIssuedAt: null }
    current.count += 1
    if (row.issuedAt && (!current.lastIssuedAt || new Date(row.issuedAt) > new Date(current.lastIssuedAt))) {
      current.lastIssuedAt = new Date(row.issuedAt)
    }
    milestoneIssueMeta.set(row.companyId, current)
  }

  for (const company of companies) {
    const primaryContact =
      company.contacts.find((c: any) => c.isPrimaryContact && c.email) ||
      company.contacts.find((c: any) => c.email) ||
      null
    if (!primaryContact || primaryContact.lifecycleOptOut) continue

    const days = daysSince(company.lastOrderDate)
    const orders = Number(company.totalOrders || 0)
    const spend = Number(company.totalRevenue || 0)
    const firstOrderValue = Number(company.companyOrders?.[0]?.orderTotal || 0)
    const strategicScore = strategicScoreFor({
      firstOrderValue,
      domain: company.primaryDomain,
      name: company.canonicalCompanyName,
      totalSpend: spend,
    })

    const stage = lifecycleStage(days, orders, spend)
    let suggestedEmailType = emailTypeFor(stage, orders)
    let rewardCatalogId: string | null = null
    let rewardName: string | null = null
    let rewardReason: string | null = null

    if (orders === 1 && days <= 45) {
      if (strategicScore >= 60 && strategicReward) {
        suggestedEmailType = 'STRATEGIC_SECOND_ORDER_VOUCHER'
        rewardCatalogId = strategicReward.rewardCatalogId
        rewardName = strategicReward.rewardName
        rewardReason = 'Strategic first-order account'
      } else if (firstOrderReward) {
        suggestedEmailType = 'SECOND_ORDER_INCENTIVE'
        rewardCatalogId = firstOrderReward.rewardCatalogId
        rewardName = firstOrderReward.rewardName
        rewardReason = 'First to second order conversion'
      }
    } else if (spend >= 1000 && milestoneReward) {
      const unlockedMilestones = Math.floor(spend / 1000)
      const milestoneMeta = milestoneIssueMeta.get(company.companyId) || { count: 0, lastIssuedAt: null }
      const cooldownDays = 30
      const lastIssuedDays = milestoneMeta.lastIssuedAt ? daysSince(milestoneMeta.lastIssuedAt) : 9999
      const hasPendingMilestoneReward = unlockedMilestones > milestoneMeta.count
      if (hasPendingMilestoneReward && lastIssuedDays >= cooldownDays) {
        suggestedEmailType = stage === 'VIP' ? 'VIP' : 'SPEND_MILESTONE_REWARD'
        rewardCatalogId = milestoneReward.rewardCatalogId
        rewardName = milestoneReward.rewardName
        rewardReason = `Spend milestone unlocked (${milestoneMeta.count + 1} of ${unlockedMilestones})`
      }
    }

    suggestions.push({
      suggestionId: `${company.companyId}:${suggestedEmailType}:${formatNZYMD(new Date())}`,
      companyId: company.companyId,
      companyName: company.canonicalCompanyName,
      contactId: primaryContact.contactId,
      contactName: [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(' ').trim() || null,
      contactEmail: primaryContact.email || null,
      firstOrderDate: company.firstOrderDate ? new Date(company.firstOrderDate).toISOString() : null,
      lastOrderDate: company.lastOrderDate ? new Date(company.lastOrderDate).toISOString() : null,
      orderCount: orders,
      totalSpend: spend,
      daysSinceLastOrder: days,
      strategicScore,
      lifecycleStage: stage,
      suggestedEmailType,
      suggestedNextAction:
        stage === 'AWAITING_SECOND_ORDER'
          ? 'Nudge second order'
          : stage === 'AT_RISK' || stage === 'LOST'
          ? 'Win-back outreach'
          : stage === 'VIP'
          ? 'VIP acknowledgement'
          : 'Post-purchase follow-up',
      rewardCatalogId,
      rewardName,
      rewardReason,
    })
  }
  return suggestions
}
