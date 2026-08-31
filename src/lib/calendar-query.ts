import { addDaysNZ, getNZDateRangeForYmd } from '@/lib/date-utils'

export type CalendarRegion = 'AKL' | 'WLG'

export function parseCalendarRegion(regionRaw: string | null): CalendarRegion | null {
  if (regionRaw === 'AKL' || regionRaw === 'WLG') return regionRaw
  return null
}

export function getDayWindowForYmd(ymd: string): { start: Date; endExclusive: Date } {
  const { start } = getNZDateRangeForYmd(ymd)
  const nextYmd = addDaysNZ(ymd, 1)
  const { start: endExclusive } = getNZDateRangeForYmd(nextYmd)
  return { start, endExclusive }
}

export function getRangeWindowForYmd(params: {
  startYmd: string
  endYmdExclusive: string
}): { start: Date; endExclusive: Date } {
  const { start } = getNZDateRangeForYmd(params.startYmd)
  const { start: endExclusive } = getNZDateRangeForYmd(params.endYmdExclusive)
  return { start, endExclusive }
}

