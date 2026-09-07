import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStaffAuthFromRequest } from '@/lib/staff-tracking-auth'
import { findActiveDispatchedOrders, stopNoticeForReason, type TrackingStopReason } from '@/lib/delivery-run-tracking'

/**
 * Delivery-run tracking status for the current staff member.
 * Used by the app to auto-start tracking when an order is dispatched to the
 * driver, and to detect server-side stops (return-to-base geofence,
 * clock-out, max-duration failsafe).
 */
export async function GET(request: NextRequest) {
  try {
    const resolvedAuth = await resolveStaffAuthFromRequest(request)
    if (!resolvedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = resolvedAuth.staff

    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null,
        status: 'active',
      },
      orderBy: { clockIn: 'desc' },
      select: {
        id: true,
        trackingStatus: true,
        trackingStartedAt: true,
        trackingStoppedAt: true,
        trackingStopReason: true,
        activeDeliveryRunStartedAt: true,
        activeDeliveryOrderIds: true,
        lastLocationPingAt: true,
        lastKnownDistanceFromBaseMeters: true,
      },
    })

    if (!activeShift) {
      return NextResponse.json({
        clockedIn: false,
        shiftId: null,
        trackingStatus: 'inactive',
        eligibleForTracking: false,
        activeDispatchedOrders: [],
      })
    }

    const dispatchedOrders = await findActiveDispatchedOrders(staff.id)

    return NextResponse.json({
      clockedIn: true,
      shiftId: activeShift.id,
      trackingStatus: activeShift.trackingStatus,
      trackingStartedAt: activeShift.trackingStartedAt,
      trackingStoppedAt: activeShift.trackingStoppedAt,
      trackingStopReason: activeShift.trackingStopReason,
      stopNotice: activeShift.trackingStopReason
        ? stopNoticeForReason(activeShift.trackingStopReason as TrackingStopReason)
        : null,
      activeDeliveryRunStartedAt: activeShift.activeDeliveryRunStartedAt,
      activeDeliveryOrderIds: activeShift.activeDeliveryOrderIds,
      lastLocationPingAt: activeShift.lastLocationPingAt,
      lastKnownDistanceFromBaseMeters: activeShift.lastKnownDistanceFromBaseMeters,
      eligibleForTracking: dispatchedOrders.length > 0,
      activeDispatchedOrders: dispatchedOrders,
    })
  } catch (error) {
    console.error('❌ Error fetching delivery-run tracking status:', error)
    return NextResponse.json({ error: 'Failed to fetch tracking status' }, { status: 500 })
  }
}
