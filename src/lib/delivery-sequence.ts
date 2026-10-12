// Helpers for driver delivery-run stop ordering.
// A "run" = one driver leaving with multiple orders at the same dispatch (leave) time on the same day.

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", ... */
export function ordinalLabel(n: number): string {
  const v = n % 100
  const suffix =
    v >= 11 && v <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th'
  return `${n}${suffix}`
}

/**
 * Key identifying a driver's delivery run. Orders sharing the same key (within one day's list)
 * are delivered on the same trip and need an explicit 1st/2nd/3rd stop order.
 * Returns null when the order isn't part of an identifiable run (no driver or no dispatch time).
 */
export function deliveryRunKey(order: { driverId?: string | null; leaveTime?: string | null }): string | null {
  const driverId = String(order.driverId || '').trim()
  const leaveTime = String(order.leaveTime || '').trim()
  if (!driverId || !leaveTime) return null
  return `${driverId}|${leaveTime}`
}

export interface RunSortableOrder {
  id: string
  createdAt: string
  deliveryTime?: string | null
  tags?: string | null
  travelTime?: string | null
  deliverySequence?: number | null
}

/**
 * Minutes since midnight at which an order has to leave: its delivery time
 * less the travel time. Null when no delivery time can be read.
 */
export function dispatchMinutes(order: RunSortableOrder): number | null {
  const deliveryTime =
    order.deliveryTime ||
    order.tags?.match(/(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)/)?.[1]

  if (!deliveryTime) return null

  // Both 24-hour ("16:30") and 12-hour ("9:00 AM") forms appear in the data.
  const twelveHour = deliveryTime.match(/(\d{1,2}:\d{2})\s*([AP]M)/)
  const twentyFourHour = twelveHour ? null : deliveryTime.match(/(\d{1,2}:\d{2})/)
  const parsed = twelveHour
    ? `${twelveHour[1]} ${twelveHour[2]}`
    : twentyFourHour
      ? twentyFourHour[1]
      : null
  if (!parsed) return null

  const asDate = new Date(`2000-01-01 ${parsed}`)
  if (isNaN(asDate.getTime())) return null

  const travelTimeMinutes = order.travelTime ? parseInt(order.travelTime) : 0
  return asDate.getHours() * 60 + asDate.getMinutes() - travelTimeMinutes
}

/**
 * Orders the day's list by when each order leaves, earliest first, while
 * keeping a driver's run together.
 *
 * A driver leaving once takes the whole run with them, so the run sits at its
 * earliest stop's dispatch time and its orders stay contiguous there, in stop
 * order. Without this, two drivers leaving at the same time interleave by
 * travel time and neither run reads as a run.
 */
export function sortOrdersIntoRuns<T extends RunSortableOrder>(
  orders: T[],
  runKeyFor: (order: T) => string | null | undefined
): T[] {
  const dispatchByOrderId = new Map<string, number | null>()
  const runKeyByOrderId = new Map<string, string>()
  const runStart = new Map<string, number>()

  for (const order of orders) {
    const dispatch = dispatchMinutes(order)
    dispatchByOrderId.set(order.id, dispatch)

    const runKey = runKeyFor(order) || ''
    runKeyByOrderId.set(order.id, runKey)
    if (!runKey || dispatch == null) continue

    const current = runStart.get(runKey)
    if (current == null || dispatch < current) runStart.set(runKey, dispatch)
  }

  const groupTimeOf = (order: T): number | null => {
    const runKey = runKeyByOrderId.get(order.id) || ''
    const runTime = runKey ? runStart.get(runKey) : undefined
    return runTime ?? dispatchByOrderId.get(order.id) ?? null
  }

  return [...orders].sort((a, b) => {
    const timeA = groupTimeOf(a)
    const timeB = groupTimeOf(b)

    // An order with no readable dispatch time sorts after those that have one.
    if (timeA !== null && timeB !== null) {
      if (timeA !== timeB) return timeA - timeB
    } else if (timeA !== null) {
      return -1
    } else if (timeB !== null) {
      return 1
    }

    const runA = runKeyByOrderId.get(a.id) || ''
    const runB = runKeyByOrderId.get(b.id) || ''
    if (runA !== runB) return runA < runB ? -1 : 1

    if (runA) {
      const seqA = a.deliverySequence ?? Number.MAX_SAFE_INTEGER
      const seqB = b.deliverySequence ?? Number.MAX_SAFE_INTEGER
      if (seqA !== seqB) return seqA - seqB
    }

    // Newest first, so a fresh order without a time lands at the top.
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
