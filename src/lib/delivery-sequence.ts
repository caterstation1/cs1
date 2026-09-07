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
