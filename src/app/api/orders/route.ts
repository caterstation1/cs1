import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📋 Fetching orders from PostgreSQL...');
    
    // Fetch all orders from PostgreSQL using Prisma
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`✅ Successfully fetched ${orders.length} orders`);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('❌ Error in orders API route:', error);
    
    // Return empty array instead of error object
    console.error('❌ Returning empty orders array due to error');
    return NextResponse.json([]);
  }
} 