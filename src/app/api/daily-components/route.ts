import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🧩 Fetching daily components from PostgreSQL...');
    
    // Fetch all components from PostgreSQL
    const dailyComponents = await prisma.component.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${dailyComponents.length} daily components`);
    return NextResponse.json({
      message: 'Fetched daily components from PostgreSQL.',
      dailyComponents
    });
  } catch (error) {
    console.error('❌ Error fetching daily components:', error);
    
    // Return empty array instead of error
    return NextResponse.json({
      message: 'Error fetching daily components',
      error: error instanceof Error ? error.message : 'Unknown error',
      dailyComponents: []
    }, { status: 200 }); // Return 200 with empty data instead of 500
  }
} 