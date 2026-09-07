import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAccessLevel } from '@/lib/authz'
import { buildLabelPrintUrl, resolveOrderDeliveryYmd } from '@/lib/labels/resolve-order'

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access || (access !== 'owner' && access !== 'admin' && access !== 'manager' && access !== 'staff')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderNumber = Number(new URL(request.url).searchParams.get('orderNumber'))
    if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
      return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber, cancelledAt: null },
      select: {
        id: true,
        orderNumber: true,
        deliveryDateResolved: true,
        deliveryDateTime: true,
        deliveryDate: true,
        pickupDate: true,
        customerFirstName: true,
        customerLastName: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: `Order ${orderNumber} not found` }, { status: 404 })
    }

    const date = resolveOrderDeliveryYmd(order)
    if (!date) {
      return NextResponse.json(
        { error: `Order ${orderNumber} has no delivery date set yet` },
        { status: 400 },
      )
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      orderId: order.id,
      date,
      customerName: [order.customerFirstName, order.customerLastName].filter(Boolean).join(' '),
      printUrl: buildLabelPrintUrl(order.orderNumber),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
