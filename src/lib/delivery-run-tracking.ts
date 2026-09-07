import { prisma } from '@/lib/prisma'
import { getNZDateRangeForYmd, formatNZYMD, getTodayLocal } from '@/lib/date-utils'

/**
 * Delivery-run scoped location tracking.
 *
 * Location tracking is tied to active dispatched delivery runs, NOT to being
 * clocked in. A driver only becomes eligible for tracking when an order has
 * been marked Dispatched and assigned to them. Tracking stops on:
 *  - manual_stop      (driver taps "Stop Tracking")
 *  - returned_to_base (driver re-enters the kitchen/base geofence after a run)
 *  - clock_out        (shift ends)
 *  - max_duration     (privacy failsafe)
 *
 * Tracking intentionally continues after delivery completion until
 * return-to-base/manual stop/clock-out/max-duration so dispatch can see driver
 * proximity to base for next deliveries.
 */

export type TrackingStopReason = 'manual_stop' | 'returned_to_base' | 'clock_out' | 'max_duration'

export const TRACKING_STOP_REASONS: TrackingStopReason[] = [
  'manual_stop',
  'returned_to_base',
  'clock_out',
  'max_duration',
]

export type TrackingStatus = 'inactive' | 'active_delivery_run' | 'stopping' | 'stopped'

const DEFAULT_BASE_RADIUS_METERS = 250
const DEFAULT_MAX_TRACKING_HOURS = 6

export type BaseLocation = {
  latitude: number
  longitude: number
  radiusMeters: number
}

function parseEnvNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Kitchen/base geofence used for return-to-base auto-stop.
 * Configured via CATERSTATION_BASE_LAT / CATERSTATION_BASE_LNG /
 * CATERSTATION_BASE_RADIUS_METERS. When lat/lng are not configured the
 * geofence auto-stop is disabled (distance from base is not computed).
 */
export function getBaseLocation(): BaseLocation | null {
  const latitude = parseEnvNumber(process.env.CATERSTATION_BASE_LAT)
  const longitude = parseEnvNumber(process.env.CATERSTATION_BASE_LNG)
  if (latitude === null || longitude === null) return null
  const radiusMeters = parseEnvNumber(process.env.CATERSTATION_BASE_RADIUS_METERS) ?? DEFAULT_BASE_RADIUS_METERS
  return { latitude, longitude, radiusMeters }
}

export function getMaxTrackingDurationMs(): number {
  const hours = parseEnvNumber(process.env.CATERSTATION_MAX_TRACKING_HOURS) ?? DEFAULT_MAX_TRACKING_HOURS
  return hours * 60 * 60 * 1000
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}

export type ActiveDispatchedOrder = {
  id: string
  orderNumber: number
  deliveryTime: string | null
  dispatchedAt: Date | null
}

/** Recently-dispatched orders stay tracking-eligible for this long regardless of delivery date. */
const FRESH_DISPATCH_WINDOW_MS = 8 * 60 * 60 * 1000

/**
 * Orders that are dispatched and assigned to this staff member.
 * These are what make a driver eligible for delivery-run location tracking.
 *
 * An order qualifies when its delivery date is today (NZ), OR when it was
 * dispatched within the last 8 hours ("fresh dispatch" window). The fresh
 * window supports test/demo orders dated on other days and lets re-dispatching
 * the same order restart tracking after a stop.
 */
export async function findActiveDispatchedOrders(staffId: string): Promise<ActiveDispatchedOrder[]> {
  const todayYmd = formatNZYMD(getTodayLocal())
  const todayRange = getNZDateRangeForYmd(todayYmd)
  const freshDispatchCutoff = new Date(Date.now() - FRESH_DISPATCH_WINDOW_MS)
  return prisma.order.findMany({
    where: {
      driverId: staffId,
      isDispatched: true,
      cancelledAt: null,
      OR: [
        { deliveryDateResolved: { gte: todayRange.start, lte: todayRange.end } },
        { deliveryDate: todayYmd },
        { dispatchedAt: { gte: freshDispatchCutoff } },
      ],
    },
    orderBy: [{ deliverySequence: { sort: 'asc', nulls: 'last' } }, { deliveryTime: 'asc' }, { orderNumber: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      deliveryTime: true,
      dispatchedAt: true,
    },
  })
}

export async function stopDeliveryRunTracking(shiftId: string, reason: TrackingStopReason, stoppedAt = new Date()) {
  return prisma.shift.update({
    where: { id: shiftId },
    data: {
      trackingStatus: 'stopped',
      trackingStoppedAt: stoppedAt,
      trackingStopReason: reason,
    },
    select: {
      id: true,
      trackingStatus: true,
      trackingStoppedAt: true,
      trackingStopReason: true,
    },
  })
}

export function stopNoticeForReason(reason: TrackingStopReason): string {
  switch (reason) {
    case 'returned_to_base':
      return 'You have returned to base. Delivery run location sharing is now off.'
    case 'clock_out':
      return 'You have clocked out. Delivery run location sharing is now off.'
    case 'max_duration':
      return 'Delivery run location sharing reached the maximum duration and is now off.'
    case 'manual_stop':
    default:
      return 'Delivery run location sharing is now off.'
  }
}
