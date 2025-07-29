import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Debugging order transformation from PostgreSQL...');
    
    // Get a sample of orders to analyze transformation
    const orders = await prisma.order.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('📋 PostgreSQL orders found:', orders.length);
    
    if (orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found in database',
        orders: []
      });
    }
    
    const orderAnalysis = orders.map(order => ({
      id: order.id,
      hasCustomerFirstName: !!order.customerFirstName,
      hasCustomerLastName: !!order.customerLastName,
      hasCustomerEmail: !!order.customerEmail,
      hasCustomerPhone: !!order.customerPhone,
      hasDeliveryDate: !!order.deliveryDate,
      hasDeliveryTime: !!order.deliveryTime,
      hasShippingAddress: !!order.shippingAddress,
      hasLineItems: !!order.lineItems,
      hasTotalPrice: !!order.totalPrice,
      hasCurrency: !!order.currency,
      hasFinancialStatus: !!order.financialStatus,
      hasFulfillmentStatus: !!order.fulfillmentStatus,
      hasTags: !!order.tags,
      hasNote: !!order.note,
      hasIsDispatched: typeof order.isDispatched === 'boolean',
      orderNumber: order.orderNumber,
      shopifyId: order.shopifyId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
    
    console.log('📊 Order transformation analysis:', orderAnalysis);
    
    return NextResponse.json({
      message: 'Order transformation debug information',
      orders: orderAnalysis,
      totalOrders: orders.length
    });
    
  } catch (error) {
    console.error('❌ Error debugging order transformation:', error);
    return NextResponse.json({
      error: 'Failed to debug order transformation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 