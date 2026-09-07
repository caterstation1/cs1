// The roster grid's day columns and the labour panel beside it are read against
// each other by eye, so both derive their day keys from formatLocalDate rather
// than from toISOString(). An ISO string is UTC, and Auckland is UTC+12 or +13,
// so any local Date whose time of day is earlier than the offset reports the
// previous calendar day — every NZDT morning before 1pm.

import { formatLocalDate } from '@/lib/date-utils'

/**
 * The seven local dates of the Monday-to-Sunday week containing `reference`.
 * Each is local midnight, so the caller can read the calendar fields off it
 * without a timezone conversion.
 */
export function rosterWeekDates(reference: Date): Date[] {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const day = start.getDay()
  start.setDate(start.getDate() - day + (day === 0 ? -6 : 1)) // Sunday belongs to the week that just ended

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    dates.push(date)
  }
  return dates
}

/** The same week as YYYY-MM-DD keys, in the local calendar. */
export function rosterWeekDateKeys(reference: Date): string[] {
  return rosterWeekDates(reference).map(formatLocalDate)
}
