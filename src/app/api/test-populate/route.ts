import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🧪 Testing data population...');
    
    // Create a test order
    const testOrder = await prisma.order.create({
      data: {
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
      }
    });
    
    console.log('✅ Created test order:', testOrder);
    
    // Clean up - delete the test order
    await prisma.order.delete({
      where: { id: testOrder.id }
    });
    
    console.log('🗑️ Cleaned up test order');
    
    return NextResponse.json({
      success: true,
      message: 'Data population test completed',
      testOrder: {
        id: testOrder.id,
        orderNumber: testOrder.orderNumber,
        customerName: `${testOrder.customerFirstName} ${testOrder.customerLastName}`
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing data population:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test data population',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 