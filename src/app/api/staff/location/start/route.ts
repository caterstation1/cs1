import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShiftTrackingToken, resolveStaffAuthFromRequest } from '@/lib/staff-tracking-auth'
import { findActiveDispatchedOrders } from '@/lib/delivery-run-tracking'

/**
 * Starts delivery-run location tracking.
 *
 * Tracking only starts when the staff member is:
 *  1. authenticated,
 *  2. clocked in (active shift), and
 *  3. assigned at least one active dispatched delivery order for today.
 *
 * Being clocked in alone is NOT enough — location sharing is tied to active
 * dispatched delivery runs, not general shift/employee tracking.
 */
export async function POST(request: NextRequest) {
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
    })

    if (!activeShift) {
      return NextResponse.json(
        { error: 'You must be clocked in before starting a delivery run.', code: 'not_clocked_in' },
        { status: 400 }
      )
    }

    const dispatchedOrders = await findActiveDispatchedOrders(staff.id)
    if (dispatchedOrders.length === 0) {
      return NextResponse.json(
        {
          error:
            'No active dispatched delivery run. Location sharing only starts when an order has been dispatched and assigned to you.',
          code: 'no_active_delivery_run',
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const updated = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        trackingAllowed: true,
        trackingStatus: 'active_delivery_run',
        // Reset per-run so max-duration failsafe measures the current run,
        // not an earlier stopped run on the same shift.
        trackingStartedAt: now,
        trackingStoppedAt: null,
        trackingStopReason: null,
        activeDeliveryRunStartedAt: activeShift.activeDeliveryRunStartedAt ?? now,
        activeDeliveryOrderIds: dispatchedOrders.map((order) => order.id),
      },
      select: {
        id: true,
        trackingStatus: true,
        trackingStartedAt: true,
        activeDeliveryRunStartedAt: true,
        activeDeliveryOrderIds: true,
      },
    })

    return NextResponse.json({
      ok: true,
      shiftId: updated.id,
      trackingStatus: updated.trackingStatus,
      trackingStartedAt: updated.trackingStartedAt,
      activeDeliveryRunStartedAt: updated.activeDeliveryRunStartedAt,
      activeDeliveryOrders: dispatchedOrders,
      trackingToken: createShiftTrackingToken({
        tokenType: 'shift_tracking',
        staffId: staff.id,
        shiftId: updated.id,
        email: staff.email,
        accessLevel: staff.accessLevel || 'basic',
      }),
    })
  } catch (error) {
    console.error('❌ Error starting delivery-run location tracking:', error)
    return NextResponse.json({ error: 'Failed to start delivery-run location tracking' }, { status: 500 })
  }
}
