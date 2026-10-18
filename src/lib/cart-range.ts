import { parseLocalDate } from '@/lib/date-utils'

/** Upper bound on how many days a single suggestion query may scan. */
export const MAX_RANGE_DAYS = 92

/**
 * Resolves the delivery window to cover for shopping suggestions.
 * `start`/`end` are inclusive YYYY-MM-DD day keys; `days` is kept for callers
 * that just want a rolling window starting today. The returned `end` is an
 * exclusive upper bound at local midnight.
 */
export function resolveSuggestRange(
  params: URLSearchParams,
  now: Date = new Date()
): { start: Date; end: Date } {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const startParam = parseLocalDate(params.get('start') || '')
  const endParam = parseLocalDate(params.get('end') || '')

  if (startParam || endParam) {
    // A single date is a one-day range; a reversed range is treated as that day.
    const start = startParam || endParam!
    let end = new Date(endParam || startParam!)
    if (end < start) end = new Date(start)
    end.setDate(end.getDate() + 1)

    const maxEnd = new Date(start)
    maxEnd.setDate(maxEnd.getDate() + MAX_RANGE_DAYS)
    return { start, end: end > maxEnd ? maxEnd : end }
  }

  const days = Math.min(MAX_RANGE_DAYS, Math.max(1, parseInt(params.get('days') || '2', 10)))
  const end = new Date(todayStart)
  end.setDate(end.getDate() + days)
  return { start: todayStart, end }
}
