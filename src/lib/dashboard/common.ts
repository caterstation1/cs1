export type CompanyStatus = 'new' | 'active' | 'at_risk' | 'lapsed' | 'reactivated'

export interface CompanyRollup {
  companyId: string
  rollupKey?: string
  companyName: string
  lifetimeRevenue: number
  lifetimeOrders: number
  avgOrderValue: number
  firstOrderDate: Date | null
  lastOrderDate: Date | null
  daysSinceLastOrder: number | null
  contacts: number
  confidenceScore: number
  primaryDomain: string | null
  primaryAddress: string
  status: CompanyStatus
  periodRevenue: number
  periodOrders: number
  isNewInPeriod: boolean
  isReturningInPeriod: boolean
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = []
  let cursor = startOfMonth(start)
  const limit = startOfMonth(end)
  while (cursor <= limit) {
    out.push(cursor)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return out
}

export function toCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(2))
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function companyStatusFromDates(
  firstOrderDate: Date | null,
  lastOrderDate: Date | null,
  referenceDate: Date,
  hadOrderInPeriod: boolean,
  priorGapDays?: number | null
): CompanyStatus {
  if (!firstOrderDate || !lastOrderDate) return 'lapsed'
  const sinceLast = diffDays(lastOrderDate, referenceDate)
  if (hadOrderInPeriod && priorGapDays != null && priorGapDays > 180) return 'reactivated'
  if (hadOrderInPeriod && firstOrderDate >= new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)) {
    return 'new'
  }
  if (sinceLast <= 90) return 'active'
  if (sinceLast <= 180) return 'at_risk'
  return 'lapsed'
}

export function formatAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const entry = value as Record<string, unknown>
  const parts = [entry.address1, entry.address2, entry.city, entry.province, entry.country]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
  return parts.join(', ')
}

export function parseProductsJson(products: unknown): Array<Record<string, any>> {
  if (!products) return []
  if (Array.isArray(products)) return products as Array<Record<string, any>>
  if (typeof products === 'string') {
    try {
      const parsed = JSON.parse(products)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function recommendedAction(row: CompanyRollup): string {
  if (row.lifetimeOrders === 1 && row.avgOrderValue > 1000) return 'Invite to corporate account'
  if (row.lifetimeOrders >= 2 && row.lifetimeOrders <= 3) return 'Send reorder prompt'
  if (row.lifetimeOrders >= 4 && row.lifetimeRevenue > 5000) return 'Assign account manager'
  if (row.status === 'at_risk') return 'Send win-back email'
  if (row.status === 'lapsed') return 'Send founder reactivation email'
  if (row.contacts >= 3) return 'Expand multi-contact account'
  if (row.lifetimeRevenue > 10000) return 'VIP account review'
  return 'Monitor account'
}

export function classifyGrowthOpportunity(row: CompanyRollup): {
  opportunityType: string
  estimatedRevenueUpside: number
  recommendedAction: string
} {
  if (row.lifetimeOrders >= 10 && row.lifetimeRevenue > 10000) {
    return {
      opportunityType: 'VIP / Key Account',
      estimatedRevenueUpside: row.avgOrderValue * 3,
      recommendedAction: 'Assign account manager / create annual catering plan',
    }
  }
  if (row.lifetimeOrders === 1 && row.lifetimeRevenue > 1000) {
    return {
      opportunityType: 'High-value single order',
      estimatedRevenueUpside: row.avgOrderValue * 2,
      recommendedAction: 'Personal follow-up and corporate account invite',
    }
  }
  if (row.status === 'at_risk' && row.lifetimeRevenue > 2000) {
    return {
      opportunityType: 'At-risk valuable company',
      estimatedRevenueUpside: row.avgOrderValue * 1.5,
      recommendedAction: 'Send win-back campaign',
    }
  }
  if (row.status === 'lapsed' && row.lifetimeRevenue > 5000) {
    return {
      opportunityType: 'Lapsed high-value company',
      estimatedRevenueUpside: row.avgOrderValue * 1,
      recommendedAction: 'Founder-style reactivation email',
    }
  }
  if (row.contacts >= 3 && row.lifetimeRevenue > 3000) {
    return {
      opportunityType: 'Multi-contact expansion account',
      estimatedRevenueUpside: row.avgOrderValue * 3,
      recommendedAction: 'Assign account manager',
    }
  }
  if (row.lifetimeOrders >= 4) {
    return {
      opportunityType: 'Frequent buyer',
      estimatedRevenueUpside: row.avgOrderValue * 2,
      recommendedAction: 'Offer priority booking / corporate plan',
    }
  }
  return {
    opportunityType: 'General account development',
    estimatedRevenueUpside: 0,
    recommendedAction: recommendedAction(row),
  }
}
