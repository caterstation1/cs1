import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStaffAuthFromRequest } from '@/lib/staff-tracking-auth'
import {
  stopDeliveryRunTracking,
  stopNoticeForReason,
  TRACKING_STOP_REASONS,
  type TrackingStopReason,
} from '@/lib/delivery-run-tracking'

export async function POST(request: NextRequest) {
  try {
    const resolvedAuth = await resolveStaffAuthFromRequest(request)
    if (!resolvedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = resolvedAuth.staff

    const body = await request.json().catch(() => ({}))
    const requestedReason = typeof body?.reason === 'string' ? body.reason : 'manual_stop'
    const reason: TrackingStopReason = TRACKING_STOP_REASONS.includes(requestedReason as TrackingStopReason)
      ? (requestedReason as TrackingStopReason)
      : 'manual_stop'

    const activeShift = await prisma.shift.findFirst({
      where: {
        ...(resolvedAuth.shiftId ? { id: resolvedAuth.shiftId } : {}),
        staffId: staff.id,
        clockOut: null,
        status: 'active',
      },
      orderBy: { clockIn: 'desc' },
      select: { id: true },
    })
    if (!activeShift) {
      return NextResponse.json({ error: 'No active shift found' }, { status: 400 })
    }

    const stopped = await stopDeliveryRunTracking(activeShift.id, reason)

    return NextResponse.json({
      ok: true,
      shiftId: activeShift.id,
      trackingStatus: stopped.trackingStatus,
      trackingStoppedAt: stopped.trackingStoppedAt,
      trackingStopReason: stopped.trackingStopReason,
      notice: stopNoticeForReason(reason),
    })
  } catch (error) {
    console.error('❌ Error stopping delivery-run location tracking:', error)
    return NextResponse.json({ error: 'Failed to stop location tracking' }, { status: 500 })
  }
}
