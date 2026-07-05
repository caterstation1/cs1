export type DatePreset =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  | 'ytd'
  | 'all_time'
  | 'custom'

export interface ExecutiveFilters {
  startDate: Date
  endDate: Date
  preset: DatePreset
  region?: string
  city?: string
  companyStatus?: string
  product?: string
  minConfidence?: number
  revenueTier?: string
  orderCountTier?: string
  topCustomerLimit?: number
  includePrivateUnmatched: boolean
  newVsReturning?: 'new' | 'returning'
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortDir: 'asc' | 'desc'
  format?: 'json' | 'csv'
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function lastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate())
}

function safeDate(raw?: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildPresetRange(preset: DatePreset): { startDate: Date; endDate: Date } {
  const now = new Date()
  const todayEnd = endOfDay(now)
  switch (preset) {
    case 'this_month': {
      return { startDate: firstDayOfMonth(now), endDate: todayEnd }
    }
    case 'last_month': {
      const previous = addMonths(now, -1)
      return { startDate: firstDayOfMonth(previous), endDate: lastDayOfMonth(previous) }
    }
    case 'last_3_months': {
      const start = firstDayOfMonth(addMonths(now, -2))
      return { startDate: start, endDate: todayEnd }
    }
    case 'last_6_months': {
      const start = firstDayOfMonth(addMonths(now, -5))
      return { startDate: start, endDate: todayEnd }
    }
    case 'ytd': {
      return {
        startDate: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        endDate: todayEnd,
      }
    }
    case 'all_time': {
      return {
        startDate: new Date('2015-01-01T00:00:00.000Z'),
        endDate: todayEnd,
      }
    }
    case 'custom':
    case 'last_12_months':
    default: {
      const start = firstDayOfMonth(addMonths(now, -11))
      return { startDate: start, endDate: todayEnd }
    }
  }
}

export function parseExecutiveFilters(searchParams: URLSearchParams): ExecutiveFilters {
  const preset = (searchParams.get('preset') || 'last_12_months') as DatePreset
  const presetRange = buildPresetRange(preset)
  const startRaw = safeDate(searchParams.get('startDate'))
  const endRaw = safeDate(searchParams.get('endDate'))
  const startDate = startRaw ? startOfDay(startRaw) : presetRange.startDate
  const endDate = endRaw ? endOfDay(endRaw) : presetRange.endDate
  const minConfidence = Number(searchParams.get('minConfidence') || '')
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(10, Number(searchParams.get('pageSize') || '50')))
  const sortDir = (searchParams.get('sortDir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  const format = (searchParams.get('format') || 'json').toLowerCase() === 'csv' ? 'csv' : 'json'
  const newVsReturningRaw = (searchParams.get('newVsReturning') || '').toLowerCase()
  const topCustomerLimitRaw = Number(searchParams.get('topCustomerLimit') || '')
  const topCustomerLimit =
    Number.isFinite(topCustomerLimitRaw) && [50, 100].includes(topCustomerLimitRaw)
      ? topCustomerLimitRaw
      : undefined
  const includePrivateRaw = (searchParams.get('includePrivateUnmatched') || '').toLowerCase()
  const includePrivateUnmatched = includePrivateRaw === '1' || includePrivateRaw === 'true'

  return {
    startDate,
    endDate,
    preset,
    region: (searchParams.get('region') || '').trim() || undefined,
    city: (searchParams.get('city') || '').trim() || undefined,
    companyStatus: (searchParams.get('companyStatus') || '').trim() || undefined,
    product: (searchParams.get('product') || '').trim() || undefined,
    minConfidence: Number.isFinite(minConfidence) ? minConfidence : undefined,
    revenueTier: (searchParams.get('revenueTier') || '').trim() || undefined,
    orderCountTier: (searchParams.get('orderCountTier') || '').trim() || undefined,
    topCustomerLimit,
    includePrivateUnmatched,
    newVsReturning:
      newVsReturningRaw === 'new' || newVsReturningRaw === 'returning'
        ? (newVsReturningRaw as 'new' | 'returning')
        : undefined,
    page,
    pageSize,
    search: (searchParams.get('search') || '').trim() || undefined,
    sortBy: (searchParams.get('sortBy') || '').trim() || undefined,
    sortDir,
    format,
  }
}
