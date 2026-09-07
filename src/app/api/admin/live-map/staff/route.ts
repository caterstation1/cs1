import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { getNZDateRangeForYmd, formatNZYMD, getTodayLocal } from '@/lib/date-utils'

type DriverOrderSummary = {
  orderId: string
  orderNumber: number
  deliveryTime: string | null
  customerName: string
  address: string
}

function buildAddress(shippingAddress: any): string {
  if (!shippingAddress) return ''
  const sa = typeof shippingAddress === 'string' ? (() => {
    try {
      return JSON.parse(shippingAddress)
    } catch {
      return {}
    }
  })() : shippingAddress

  return [sa.address1, sa.address2, sa.city, sa.province, sa.zip].filter(Boolean).join(', ')
}

export async function GET(_request: NextRequest) {
  try {
    await requireRole(['owner', 'admin', 'manager'])

    // Only drivers on an active dispatched delivery run appear on the map.
    const activeShifts = await prisma.shift.findMany({
      where: {
        clockOut: null,
        status: 'active',
        trackingStatus: 'active_delivery_run',
        trackingStoppedAt: null,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { clockIn: 'asc' },
    })

    if (activeShifts.length === 0) {
      return NextResponse.json({ staff: [], fetchedAt: new Date().toISOString() })
    }

    const shiftIds = activeShifts.map((s) => s.id)
    const staffIds = activeShifts.map((s) => s.staffId)

    const pings = await prisma.staffLocationPing.findMany({
      where: {
        shiftId: { in: shiftIds },
      },
      orderBy: [{ capturedAt: 'desc' }, { createdAt: 'desc' }],
    })

    const latestPingByShift = new Map<string, (typeof pings)[number]>()
    for (const ping of pings) {
      if (!latestPingByShift.has(ping.shiftId)) {
        latestPingByShift.set(ping.shiftId, ping)
      }
    }

    const todayYmd = formatNZYMD(getTodayLocal())
    const todayRange = getNZDateRangeForYmd(todayYmd)
    const assignedOrders = await prisma.order.findMany({
      where: {
        driverId: { in: staffIds },
        cancelledAt: null,
        OR: [
          { deliveryDateResolved: { gte: todayRange.start, lte: todayRange.end } },
          { deliveryDate: todayYmd },
        ],
      },
      orderBy: [{ deliveryTime: 'asc' }, { orderNumber: 'asc' }],
      select: {
        id: true,
        orderNumber: true,
        driverId: true,
        deliveryTime: true,
        customerFirstName: true,
        customerLastName: true,
        shippingAddress: true,
      },
    })

    const ordersByDriver = new Map<string, DriverOrderSummary[]>()
    for (const order of assignedOrders) {
      if (!order.driverId) continue
      const list = ordersByDriver.get(order.driverId) || []
      list.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryTime: order.deliveryTime,
        customerName: `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim(),
        address: buildAddress(order.shippingAddress),
      })
      ordersByDriver.set(order.driverId, list)
    }

    const payload = activeShifts
      .map((shift) => {
        const latestPing = latestPingByShift.get(shift.id)
        if (!latestPing) return null

        const staffOrders = ordersByDriver.get(shift.staffId) || []
        return {
          staffUserId: shift.staffId,
          shiftId: shift.id,
          staffName: `${shift.staff?.firstName || ''} ${shift.staff?.lastName || ''}`.trim(),
          staffEmail: shift.staff?.email || '',
          shiftStart: shift.clockIn,
          deliveryRunStartedAt: shift.activeDeliveryRunStartedAt || shift.trackingStartedAt,
          distanceFromBaseMeters: shift.lastKnownDistanceFromBaseMeters,
          lastSeen: latestPing.createdAt.toISOString(),
          location: {
            latitude: latestPing.latitude,
            longitude: latestPing.longitude,
            accuracy: latestPing.accuracy,
            speed: latestPing.speed,
            heading: latestPing.heading,
          },
          assignedOrders: staffOrders,
          currentDelivery: staffOrders[0] || null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      staff: payload,
      fetchedAt: new Date().toISOString(),
      minRefreshSeconds: 90,
    })
  } catch (error: any) {
    if (error?.status === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('❌ Error fetching live map staff:', error)
    return NextResponse.json({ error: 'Failed to fetch live map staff' }, { status: 500 })
  }
}
