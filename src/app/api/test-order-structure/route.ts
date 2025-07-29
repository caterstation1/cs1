import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testing order structure from PostgreSQL...');
    
    const orders = await prisma.order.findMany({
      take: 1,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found in database',
        structure: null
      });
    }
    
    const firstOrder = orders[0];
    
    const structure = {
      id: firstOrder.id,
      keys: Object.keys(firstOrder),
      hasCustomerFirstName: !!firstOrder.customerFirstName,
      hasCustomerLastName: !!firstOrder.customerLastName,
      hasCustomerEmail: !!firstOrder.customerEmail,
      hasCustomerPhone: !!firstOrder.customerPhone,
      hasShippingAddress: !!firstOrder.shippingAddress,
      hasLineItems: !!firstOrder.lineItems,
      hasDeliveryDate: !!firstOrder.deliveryDate,
      hasDeliveryTime: !!firstOrder.deliveryTime,
      hasTotalPrice: !!firstOrder.totalPrice,
      hasCurrency: !!firstOrder.currency,
      hasFinancialStatus: !!firstOrder.financialStatus,
      hasFulfillmentStatus: !!firstOrder.fulfillmentStatus,
      hasTags: !!firstOrder.tags,
      hasNote: !!firstOrder.note,
      hasShopifyId: !!firstOrder.shopifyId,
      hasOrderNumber: !!firstOrder.orderNumber,
      sampleData: {
        customerFirstName: firstOrder.customerFirstName,
        customerLastName: firstOrder.customerLastName,
        customerEmail: firstOrder.customerEmail,
        totalPrice: firstOrder.totalPrice,
        currency: firstOrder.currency,
        orderNumber: firstOrder.orderNumber,
        shopifyId: firstOrder.shopifyId
      }
    };
    
    console.log('📊 Order structure:', structure);
    
    return NextResponse.json({
      message: 'Order structure test from PostgreSQL',
      structure
    });
    
  } catch (error) {
    console.error('❌ Error testing order structure:', error);
    return NextResponse.json({
      error: 'Failed to test order structure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 