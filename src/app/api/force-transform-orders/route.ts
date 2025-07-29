import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🔄 Force transforming existing orders...');
    
    // Get all orders from PostgreSQL
    const orders = await prisma.order.findMany({
      take: 100,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 Found ${orders.length} orders to transform`);
    
    let transformedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const order of orders) {
      try {
        console.log(`🔄 Processing order ${order.id}...`);
        
        // Check if order already has correct format
        const hasCorrectFormat = order.customerFirstName && 
                               order.customerLastName && 
                               order.customerPhone !== undefined &&
                               order.deliveryTime !== undefined &&
                               order.deliveryDate !== undefined &&
                               Array.isArray(order.lineItems);
        
        if (hasCorrectFormat) {
          console.log(`⏭️ Order ${order.id} already has correct format, skipping`);
          skippedCount++;
          continue;
        }
        
        // For now, just log that we found an order that needs transformation
        console.log(`✅ Found order ${order.id} that may need transformation`);
        transformedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`🎉 Transformation check completed! Checked: ${transformedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    
    return NextResponse.json({
      success: true,
      message: `Checked ${transformedCount} orders for transformation`,
      transformedCount,
      skippedCount,
      errorCount,
      total: orders.length
    });
    
  } catch (error) {
    console.error('❌ Error in transformation check:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during transformation check',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 