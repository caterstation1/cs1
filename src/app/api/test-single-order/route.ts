import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testing single order from PostgreSQL...');
    
    const orders = await prisma.order.findMany({
      take: 1,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (orders.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No orders found'
      });
    }
    
    const firstOrder = orders[0];
    console.log('📋 First order data:', {
      id: firstOrder.id,
      customerFirstName: firstOrder.customerFirstName,
      customerLastName: firstOrder.customerLastName,
      customerPhone: firstOrder.customerPhone,
      deliveryTime: firstOrder.deliveryTime,
      deliveryDate: firstOrder.deliveryDate,
      hasLocalEdits: firstOrder.hasLocalEdits,
      isDispatched: firstOrder.isDispatched,
      // Check Prisma fields
      hasShippingAddress: !!firstOrder.shippingAddress,
      hasLineItems: !!firstOrder.lineItems,
      hasNoteAttributes: !!firstOrder.noteAttributes
    });
    
    // Get sample data from PostgreSQL
    const sampleOrders = await prisma.order.findMany({
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        customerFirstName: true,
        customerLastName: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('📋 Sample order IDs from PostgreSQL:', sampleOrders.map(o => o.id));
    
    // Check transformation status
    const transformationStatus = {
      hasCustomerFirstName: !!firstOrder.customerFirstName,
      hasCustomerLastName: !!firstOrder.customerLastName,
      hasCustomerPhone: !!firstOrder.customerPhone,
      hasDeliveryTime: !!firstOrder.deliveryTime,
      hasDeliveryDate: !!firstOrder.deliveryDate,
      hasLocalEdits: !!firstOrder.hasLocalEdits,
      isDispatched: !!firstOrder.isDispatched
    };
    
    return NextResponse.json({
      success: true,
      orderId: firstOrder.id,
      transformationStatus,
      sampleData: {
        id: firstOrder.id,
        hasPrismaFields: {
          hasShippingAddress: !!firstOrder.shippingAddress,
          hasLineItems: !!firstOrder.lineItems,
          hasNoteAttributes: !!firstOrder.noteAttributes
        },
        postgresqlData: {
          fields: Object.keys(firstOrder),
          hasCustomerFirstName: !!firstOrder.customerFirstName,
          hasCustomerLastName: !!firstOrder.customerLastName,
          hasCustomerPhone: !!firstOrder.customerPhone,
          hasDeliveryTime: !!firstOrder.deliveryTime,
          hasDeliveryDate: !!firstOrder.deliveryDate,
          hasLineItems: !!firstOrder.lineItems
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing single order:', error);
    return NextResponse.json({
      success: false,
      message: 'Error testing single order',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 