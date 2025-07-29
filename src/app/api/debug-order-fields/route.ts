import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Debugging order fields from PostgreSQL...');
    
    // Get a sample of orders to analyze their fields
    const orders = await prisma.order.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 Found ${orders.length} orders`);
    
    if (orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found in database',
        orderFields: []
      });
    }
    
    const orderFields = orders.map(order => {
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        shopifyId: order.shopifyId,
        customerEmail: order.customerEmail,
        customerFirstName: order.customerFirstName,
        customerLastName: order.customerLastName,
        totalPrice: order.totalPrice,
        currency: order.currency,
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        isDispatched: order.isDispatched,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Show which fields are present
        hasShippingAddress: !!order.shippingAddress,
        hasBillingAddress: !!order.billingAddress,
        hasLineItems: !!order.lineItems,
        hasNote: !!order.note,
        hasTags: !!order.tags
      };
    });
    
    console.log('📊 Order fields analysis:', orderFields);
    
    return NextResponse.json({
      message: 'Order fields debug information',
      orderFields,
      totalOrders: orders.length
    });
    
  } catch (error) {
    console.error('❌ Error debugging order fields:', error);
    return NextResponse.json({
      error: 'Failed to debug order fields',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 