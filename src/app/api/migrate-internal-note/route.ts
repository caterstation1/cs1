import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🔄 Starting internalNote migration...');
    
    // Add the internalNote column to the Order table
    const result = await prisma.$executeRaw`
      ALTER TABLE "Order" 
      ADD COLUMN "internalNote" TEXT;
    `;
    
    console.log('✅ internalNote column added successfully');
    
    // Verify the column was added
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Order' AND column_name = 'internalNote';
    `;
    
    console.log('📋 Column verification result:', columns);
    
    return NextResponse.json({
      success: true,
      message: 'internalNote column added successfully',
      result,
      columns
    });
  } catch (error) {
    console.error('❌ Error in internalNote migration:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 