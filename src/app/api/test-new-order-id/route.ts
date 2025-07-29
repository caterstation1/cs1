import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🧪 Testing new order ID generation...');
    
    // Get the first order to test ID format
    const testOrder = await prisma.order.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!testOrder) {
      return NextResponse.json({
        success: false,
        message: 'No orders found to test ID format'
      });
    }
    
    console.log('📋 Test order data:', {
      id: testOrder.id,
      orderNumber: testOrder.orderNumber,
      customerFirstName: testOrder.customerFirstName,
      customerLastName: testOrder.customerLastName,
      customerName: `${testOrder.customerFirstName} ${testOrder.customerLastName}`
    });
    
    // Test creating a new order with a unique ID
    const newOrderData = {
      shopifyId: `test_${Date.now()}`,
      orderNumber: Math.floor(Math.random() * 1000000),
      createdAt: new Date(),
      updatedAt: new Date(),
      totalPrice: 100.00,
      subtotalPrice: 90.00,
      totalTax: 10.00,
      currency: 'NZD',
      financialStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      customerEmail: 'test@example.com',
      customerFirstName: 'Test',
      customerLastName: 'Customer',
      customerPhone: '+64212345678',
      lineItems: [],
      source: 'test',
      hasLocalEdits: false,
      syncedAt: new Date()
    };
    
    const result = await prisma.order.create({
      data: newOrderData
    });
    
    console.log('✅ Created test order:', {
      id: result.id,
      orderNumber: result.orderNumber,
      customerFirstName: result.customerFirstName,
      customerLastName: result.customerLastName,
      customerName: `${result.customerFirstName} ${result.customerLastName}`
    });
    
    // Clean up - delete the test order
    await prisma.order.delete({
      where: { id: result.id }
    });
    
    console.log('🗑️ Cleaned up test order');
    
    return NextResponse.json({
      success: true,
      message: 'New order ID generation test completed',
      testOrder: {
        id: testOrder.id,
        orderNumber: testOrder.orderNumber,
        customerName: `${testOrder.customerFirstName} ${testOrder.customerLastName}`
      },
      newOrder: {
        id: result.id,
        orderNumber: result.orderNumber,
        customerName: `${result.customerFirstName} ${result.customerLastName}`
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing new order ID:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test new order ID',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 