import { prisma } from '@/lib/prisma'

export async function listRewardCatalog() {
  return (prisma as any).rewardCatalog.findMany({
    orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { rewardName: 'asc' }],
  })
}

export async function upsertRewardCatalogItem(input: {
  rewardCatalogId?: string
  rewardName: string
  rewardType: string
  defaultCode?: string | null
  codePrefix?: string | null
  perceivedValue?: number
  estimatedActualCost?: number
  minimumSpend?: number | null
  expiryDays?: number
  enabled?: boolean
  eligibleEmailTypes?: string[]
  sortOrder?: number
}) {
  const data = {
    rewardName: input.rewardName,
    rewardType: input.rewardType,
    defaultCode: input.defaultCode || null,
    codePrefix: input.codePrefix || null,
    perceivedValue: Number(input.perceivedValue || 0),
    estimatedActualCost: Number(input.estimatedActualCost || 0),
    minimumSpend: input.minimumSpend == null ? null : Number(input.minimumSpend),
    expiryDays: Math.max(1, Number(input.expiryDays || 30)),
    enabled: input.enabled !== false,
    eligibleEmailTypes: Array.isArray(input.eligibleEmailTypes) ? input.eligibleEmailTypes : [],
    sortOrder: Number(input.sortOrder || 0),
  }

  if (input.rewardCatalogId) {
    return (prisma as any).rewardCatalog.update({
      where: { rewardCatalogId: input.rewardCatalogId },
      data,
    })
  }
  return (prisma as any).rewardCatalog.create({ data })
}
