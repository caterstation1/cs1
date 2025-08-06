import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Debug orders API...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test order count
    const orderCount = await prisma.order.count();
    console.log(`📊 Order count: ${orderCount}`);
    
    // Test the exact same query as the main orders endpoint
    console.log('🔍 Testing findMany query...');
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 findMany returned ${orders.length} orders`);
    
    // Test with select like the working test endpoint
    console.log('🔍 Testing findFirst with select...');
    const testOrder = await prisma.order.findFirst({
      select: {
        id: true,
        orderNumber: true,
        shopifyId: true,
        createdAt: true
      }
    });
    
    console.log('📋 findFirst with select returned:', testOrder);
    
    return NextResponse.json({
      success: true,
      orderCount,
      findManyCount: orders.length,
      findFirstResult: testOrder,
      firstOrderFromFindMany: orders.length > 0 ? {
        id: orders[0].id,
        orderNumber: orders[0].orderNumber,
        shopifyId: orders[0].shopifyId,
        createdAt: orders[0].createdAt
      } : null
    });
  } catch (error) {
    console.error('❌ Error in debug orders API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 