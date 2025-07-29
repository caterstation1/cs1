import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching stock from PostgreSQL...');
    
    // For now, return empty stock since we don't have a stock model
    // You can add a stock model to your Prisma schema if needed
    const stock: any[] = [];
    
    console.log(`✅ Successfully fetched ${stock.length} stock items`);
    return NextResponse.json({ stock });
  } catch (error) {
    console.error('❌ Error fetching stock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
} 