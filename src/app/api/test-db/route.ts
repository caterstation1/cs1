import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🧪 Testing Prisma database connection...');
    
    // Test basic database connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection test successful:', result);
    
    // Test if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('📋 Available tables:', tables);
    
    return NextResponse.json({
      message: 'Database connection test successful',
      test: result,
      tables: tables
    });
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return NextResponse.json(
      { 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 