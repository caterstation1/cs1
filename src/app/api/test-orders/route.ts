import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testing orders API...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test order count
    const orderCount = await prisma.order.count();
    console.log(`📊 Order count: ${orderCount}`);
    
    // Test fetching a single order
    const sampleOrder = await prisma.order.findFirst({
      select: {
        id: true,
        orderNumber: true,
        shopifyId: true,
        createdAt: true
      }
    });
    
    console.log('📋 Sample order:', sampleOrder);
    
    return NextResponse.json({
      success: true,
      orderCount,
      sampleOrder,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
      nodeEnv: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('❌ Error in test orders API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
      nodeEnv: process.env.NODE_ENV
    });
  }
} 