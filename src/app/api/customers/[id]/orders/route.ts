import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = id; // This is the customer email
    console.log(`📋 Fetching orders for customer: ${customerId}`);

    const orders = await prisma.order.findMany({
      where: {
        customerEmail: customerId
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        deliveryDate: true,
        totalPrice: true,
        fulfillmentStatus: true,
        lineItems: true,
        customerFirstName: true,
        customerLastName: true,
        customerEmail: true,
        customerPhone: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${orders.length} orders for customer ${customerId}`);

    return NextResponse.json({
      orders: orders.map(order => ({
        ...order,
        total: order.totalPrice, // Map totalPrice to total for frontend compatibility
        status: order.fulfillmentStatus // Map fulfillmentStatus to status
      })),
      customer: {
        email: customerId,
        firstName: orders[0]?.customerFirstName || '',
        lastName: orders[0]?.customerLastName || '',
        phone: orders[0]?.customerPhone || ''
      }
    });

  } catch (error) {
    console.error('❌ Error fetching customer orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer orders' },
      { status: 500 }
    );
  }
}
