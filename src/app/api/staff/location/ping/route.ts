import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStaffAuthFromRequest } from '@/lib/staff-tracking-auth'
import {
  getBaseLocation,
  getMaxTrackingDurationMs,
  haversineMeters,
  stopDeliveryRunTracking,
  stopNoticeForReason,
} from '@/lib/delivery-run-tracking'

const MIN_PING_INTERVAL_MS = 60_000

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const resolvedAuth = await resolveStaffAuthFromRequest(request)
    if (!resolvedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = resolvedAuth.staff

    const body = await request.json().catch(() => ({}))
    const latitude = asNumber(body?.latitude ?? body?.lat)
    const longitude = asNumber(body?.longitude ?? body?.lng)
    const accuracy = asNumber(body?.accuracy)
    const speed = asNumber(body?.speed)
    const heading = asNumber(body?.heading)
    const force = Boolean(body?.force)
    const capturedAt = body?.capturedAt ? new Date(body.capturedAt) : new Date()

    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
    }
    if (Number.isNaN(capturedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid capturedAt timestamp' }, { status: 400 })
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        ...(resolvedAuth.shiftId ? { id: resolvedAuth.shiftId } : {}),
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
        lastKnownDistanceFromBaseMeters: true,
      },
    })

    if (!activeShift) {
      // 410 tells native clients the tracking session is over so they stop pinging.
      return NextResponse.json(
        { error: 'No active shift found', code: 'tracking_stopped', stopReason: 'clock_out' },
        { status: 410 }
      )
    }

    // Pings are only saved while a dispatched delivery run is actively tracked.
    if (activeShift.trackingStatus !== 'active_delivery_run' || activeShift.trackingStoppedAt) {
      return NextResponse.json(
        {
          error: 'Delivery run location sharing is not active',
          code: 'tracking_stopped',
          trackingStatus: activeShift.trackingStatus,
        },
        { status: 410 }
      )
    }

    // Privacy failsafe: never track longer than the configured maximum, even
    // if every other stop path is missed.
    const nowMs = Date.now()
    const maxDurationMs = getMaxTrackingDurationMs()
    if (activeShift.trackingStartedAt && nowMs - activeShift.trackingStartedAt.getTime() > maxDurationMs) {
      await stopDeliveryRunTracking(activeShift.id, 'max_duration')
      return NextResponse.json(
        {
          error: 'Delivery run location sharing reached the maximum duration',
          code: 'tracking_stopped',
          stopReason: 'max_duration',
          notice: stopNoticeForReason('max_duration'),
        },
        { status: 410 }
      )
    }

    const previousPing = await prisma.staffLocationPing.findFirst({
      where: { shiftId: activeShift.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    if (previousPing && !force) {
      const delta = nowMs - previousPing.createdAt.getTime()
      if (delta < MIN_PING_INTERVAL_MS) {
        return NextResponse.json(
          { error: 'Ping sent too soon', retryAfterSeconds: Math.ceil((MIN_PING_INTERVAL_MS - delta) / 1000) },
          { status: 429 }
        )
      }
    }

    const base = getBaseLocation()
    const distanceFromBaseMeters = base
      ? haversineMeters(latitude, longitude, base.latitude, base.longitude)
      : null

    const result = await prisma.$transaction(async (tx) => {
      const ping = await tx.staffLocationPing.create({
        data: {
          staffId: staff.id,
          shiftId: activeShift.id,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          capturedAt,
        },
        select: {
          id: true,
          capturedAt: true,
          createdAt: true,
        },
      })

      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          lastLocationPingAt: ping.createdAt,
          ...(distanceFromBaseMeters !== null ? { lastKnownDistanceFromBaseMeters: distanceFromBaseMeters } : {}),
        },
      })

      return ping
    })

    // Return-to-base geofence auto-stop: only triggers after the driver has
    // actually been away from base (previous known distance outside the
    // radius), so tracking is not stopped immediately when a run starts at the
    // kitchen. Order completion intentionally does NOT stop tracking —
    // tracking continues after delivery completion until
    // return-to-base/manual stop/clock-out/max-duration so dispatch can see
    // driver proximity to base for next deliveries.
    if (
      base &&
      distanceFromBaseMeters !== null &&
      distanceFromBaseMeters <= base.radiusMeters &&
      activeShift.lastKnownDistanceFromBaseMeters !== null &&
      activeShift.lastKnownDistanceFromBaseMeters > base.radiusMeters
    ) {
      await stopDeliveryRunTracking(activeShift.id, 'returned_to_base')
      return NextResponse.json(
        {
          ok: true,
          ping: result,
          stopped: true,
          stopReason: 'returned_to_base',
          notice: stopNoticeForReason('returned_to_base'),
          distanceFromBaseMeters: Math.round(distanceFromBaseMeters),
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        ping: result,
        ...(distanceFromBaseMeters !== null ? { distanceFromBaseMeters: Math.round(distanceFromBaseMeters) } : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ Error storing staff location ping:', error)
    return NextResponse.json({ error: 'Failed to store location ping' }, { status: 500 })
  }
}
