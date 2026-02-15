import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to build address from shippingAddress JSON
function buildAddress(sa: any): string {
  if (!sa) return ''
  try {
    const addr = typeof sa === 'string' ? JSON.parse(sa) : sa
    const parts = [
      addr.address1,
      addr.address2,
      addr.city,
      addr.province,
      addr.zip,
      'New Zealand'
    ].filter((p: string) => !!p && String(p).trim().length > 0)
    return parts.join(', ')
  } catch {
    return typeof sa === 'string' ? sa : ''
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // YYYY-MM-DD
    const driverId = searchParams.get('driverId')
    const leaveTime = searchParams.get('leaveTime') // HH:MM - dispatch time

    if (!date || !driverId || !leaveTime) {
      return NextResponse.json(
        { error: 'Missing required parameters: date, driverId, and leaveTime are required' },
        { status: 400 }
      )
    }

    // Default origin address
    const origin = '562 Richmond Road, Grey Lynn, Auckland 1021'

    // Query orders with same deliveryDate, same driverId, same leaveTime (dispatch time), excluding cancelled
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: date,
        driverId: driverId,
        leaveTime: leaveTime, // Same dispatch time
        cancelledAt: null
      },
      select: {
        id: true,
        orderNumber: true,
        customerFirstName: true,
        customerLastName: true,
        deliveryTime: true,
        shippingAddress: true
      },
      orderBy: {
        deliveryTime: 'asc' // Sort by delivery time within the same dispatch
      },
      take: 10 // Google waypoint limit
    })

    // Build stops array, skipping orders with missing addresses
    const stops = []
    for (const order of orders) {
      const address = buildAddress(order.shippingAddress)
      if (!address || address.trim().length === 0) {
        console.warn(`⚠️ Skipping order ${order.orderNumber} - missing address`)
        continue
      }

      const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Unknown Customer'

      stops.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: customerName,
        deliveryTime: order.deliveryTime || '',
        address: address
      })
    }

    return NextResponse.json({
      origin: origin,
      stops: stops
    })
  } catch (error) {
    console.error('❌ Error fetching driver run:', error)
    return NextResponse.json(
      { error: 'Failed to fetch driver run' },
      { status: 500 }
    )
  }
}
