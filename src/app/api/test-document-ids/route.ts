import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testing document IDs from PostgreSQL...');
    
    const orders = await prisma.order.findMany({
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        shopifyId: true,
        customerFirstName: true,
        customerLastName: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 Found ${orders.length} orders`);
    
    const documentIds = orders.map(order => ({
      documentId: order.id,
      orderNumber: order.orderNumber,
      shopifyId: order.shopifyId,
      customerName: `${order.customerFirstName} ${order.customerLastName}`
    }));
    
    console.log('📊 Document IDs:', documentIds);
    
    return NextResponse.json({
      message: 'Document IDs test from PostgreSQL',
      count: documentIds.length,
      documentIds
    });
    
  } catch (error) {
    console.error('❌ Error testing document IDs:', error);
    return NextResponse.json({
      error: 'Failed to test document IDs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 