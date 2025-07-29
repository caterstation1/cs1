import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('⏰ Fetching shift types from PostgreSQL...');
    
    const shiftTypes = await prisma.shiftType.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${shiftTypes.length} shift types`);
    return NextResponse.json(shiftTypes);
  } catch (error) {
    console.error('❌ Error fetching shift types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shift types' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const shiftType = await prisma.shiftType.create({
      data: {
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        color: body.color || '#3B82F6',
        isActive: body.isActive !== false
      }
    });
    
    console.log(`✅ Created shift type: ${shiftType.name}`);
    return NextResponse.json(shiftType, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating shift type:', error);
    return NextResponse.json(
      { error: 'Failed to create shift type' },
      { status: 500 }
    );
  }
} 