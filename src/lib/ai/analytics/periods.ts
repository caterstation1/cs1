import { addDaysNZ, formatNZYMD, getNZDateRangeForYmd, getTodayLocal } from '@/lib/date-utils'

/** Named NZ periods aligned with dashboard / accounting conventions. */
export type PeriodKey =
  | 'today'
  | 'yesterday'
  | 'this_week_wtd'
  | 'last_week_same_days'
  | 'last_week_full'
  | 'this_month_mtd'
  | 'last_month_same_days'
  | 'last_7d'
  | 'last_30d'
  | 'ytd'

export interface ResolvedPeriod {
  key: PeriodKey
  label: string
  start: Date
  end: Date
  /** createdAt filter (orders placed) vs deliveryDate (out-the-door) */
  dateField: 'createdAt' | 'deliveryDate'
}

function mondayOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - daysToMonday)
  return copy
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

/** Resolve a named period to absolute NZ date range. Default: createdAt (sales booked). */
export function resolvePeriod(
  key: PeriodKey,
  opts?: { dateField?: 'createdAt' | 'deliveryDate' },
): ResolvedPeriod {
  const dateField = opts?.dateField ?? 'createdAt'
  const today = getTodayLocal()
  const todayYmd = formatNZYMD(today)
  const { start: nzTodayStart, end: nzTodayEnd } = getNZDateRangeForYmd(todayYmd)

  const label = key.replace(/_/g, ' ')

  switch (key) {
    case 'today':
      return { key, label: 'Today', start: nzTodayStart, end: nzTodayEnd, dateField }

    case 'yesterday': {
      const ymd = addDaysNZ(todayYmd, -1)
      const { start, end } = getNZDateRangeForYmd(ymd)
      return { key, label: 'Yesterday', start, end, dateField }
    }

    case 'this_week_wtd': {
      const weekStart = mondayOfWeek(today)
      const weekStartYmd = formatNZYMD(weekStart)
      const { start } = getNZDateRangeForYmd(weekStartYmd)
      return { key, label: 'This week (WTD)', start, end: nzTodayEnd, dateField }
    }

    case 'last_week_same_days': {
      const weekStart = mondayOfWeek(today)
      const dayOfWeek = today.getDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const lastWeekMonday = new Date(weekStart)
      lastWeekMonday.setDate(lastWeekMonday.getDate() - 7)
      const lastWeekSameDay = new Date(lastWeekMonday)
      lastWeekSameDay.setDate(lastWeekSameDay.getDate() + daysFromMonday)
      const startYmd = formatNZYMD(lastWeekMonday)
      const endYmd = formatNZYMD(lastWeekSameDay)
      const { start } = getNZDateRangeForYmd(startYmd)
      const { end } = getNZDateRangeForYmd(endYmd)
      return {
        key,
        label: 'Last week (same days WTD)',
        start,
        end,
        dateField,
      }
    }

    case 'last_week_full': {
      const weekStart = mondayOfWeek(today)
      const lastMonday = new Date(weekStart)
      lastMonday.setDate(lastMonday.getDate() - 7)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastSunday.getDate() + 6)
      const { start } = getNZDateRangeForYmd(formatNZYMD(lastMonday))
      const { end } = getNZDateRangeForYmd(formatNZYMD(lastSunday))
      return { key, label: 'Last week (full)', start, end, dateField }
    }

    case 'this_month_mtd': {
      const monthStart = firstOfMonth(today)
      const { start } = getNZDateRangeForYmd(formatNZYMD(monthStart))
      return { key, label: 'This month (MTD)', start, end: nzTodayEnd, dateField }
    }

    case 'last_month_same_days': {
      const monthStart = firstOfMonth(today)
      const lastMonthStart = new Date(monthStart)
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
      const dayOfMonth = today.getDate()
      const lastMonthSameDay = new Date(lastMonthStart)
      lastMonthSameDay.setDate(Math.min(dayOfMonth, new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate()))
      const { start } = getNZDateRangeForYmd(formatNZYMD(lastMonthStart))
      const { end } = getNZDateRangeForYmd(formatNZYMD(lastMonthSameDay))
      return { key, label: 'Last month (same days MTD)', start, end, dateField }
    }

    case 'last_7d': {
      const startYmd = addDaysNZ(todayYmd, -6)
      const { start } = getNZDateRangeForYmd(startYmd)
      return { key, label: 'Last 7 days', start, end: nzTodayEnd, dateField }
    }

    case 'last_30d': {
      const startYmd = addDaysNZ(todayYmd, -29)
      const { start } = getNZDateRangeForYmd(startYmd)
      return { key, label: 'Last 30 days', start, end: nzTodayEnd, dateField }
    }

    case 'ytd': {
      const yearStart = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0)
      const { start } = getNZDateRangeForYmd(formatNZYMD(yearStart))
      return { key, label: 'Year to date', start, end: nzTodayEnd, dateField }
    }

    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

export const PERIOD_KEYS: PeriodKey[] = [
  'today', 'yesterday', 'this_week_wtd', 'last_week_same_days', 'last_week_full',
  'this_month_mtd', 'last_month_same_days', 'last_7d', 'last_30d', 'ytd',
]

export function normalizePeriodKey(raw: string | undefined, fallback: PeriodKey): PeriodKey {
  const k = String(raw || '').toLowerCase().replace(/\s+/g, '_') as PeriodKey
  if (PERIOD_KEYS.includes(k)) return k
  return fallback
}
