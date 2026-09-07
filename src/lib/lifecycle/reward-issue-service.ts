import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'

function randomCode(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${token}`
}

export async function issueReward(input: {
  companyId: string
  contactId?: string | null
  rewardCatalogId: string
  sourceType?: 'rule' | 'manual'
  sourceRuleKey?: string | null
  notes?: string | null
  status?: 'draft' | 'issued' | 'sent' | 'redeemed' | 'expired' | 'cancelled'
  code?: string
  expiryDate?: Date
}) {
  const reward = await (prisma as any).rewardCatalog.findUnique({
    where: { rewardCatalogId: input.rewardCatalogId },
  })
  if (!reward) throw new Error('Reward catalog item not found')

  const prefix = String(reward.codePrefix || reward.defaultCode || 'REWARD').replace(/\s+/g, '').toUpperCase()
  const code = input.code || randomCode(prefix)
  const issuedDate = new Date()
  const expiryYmd = input.expiryDate
    ? input.expiryDate.toISOString().slice(0, 10)
    : addDaysNZ(formatNZYMD(issuedDate), Number(reward.expiryDays || 30))
  const expiryDate = input.expiryDate || new Date(`${expiryYmd}T23:59:59.999Z`)

  return (prisma as any).rewardIssue.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId || null,
      rewardCatalogId: input.rewardCatalogId,
      code,
      status: input.status || 'draft',
      issuedAt: issuedDate,
      expiryDate,
      sourceType: input.sourceType || 'manual',
      sourceRuleKey: input.sourceRuleKey || null,
      notes: input.notes || null,
    },
  })
}

export async function updateRewardIssueStatus(input: {
  rewardIssueId: string
  status: 'draft' | 'issued' | 'sent' | 'redeemed' | 'expired' | 'cancelled'
  notes?: string | null
}) {
  const patch: Record<string, any> = {
    status: input.status,
  }
  if (typeof input.notes === 'string') patch.notes = input.notes
  return (prisma as any).rewardIssue.update({
    where: { rewardIssueId: input.rewardIssueId },
    data: patch,
  })
}

export async function listRewardIssues(limit = 200) {
  return (prisma as any).rewardIssue.findMany({
    include: {
      company: true,
      contact: true,
      rewardCatalog: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  })
}
