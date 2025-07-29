import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    
    console.log('⏰ Fetching timesheet entries from PostgreSQL...');
    
    let whereClause = {};
    if (staffId) {
      whereClause = { staffId };
    }
    
    const shifts = await prisma.shift.findMany({
      where: whereClause,
      include: {
        staff: true
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    console.log(`✅ Successfully fetched ${shifts.length} timesheet entries`);
    return NextResponse.json(shifts);
  } catch (error) {
    console.error('❌ Error fetching timesheet entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const shift = await prisma.shift.create({
      data: {
        staffId: body.staffId,
        clockIn: new Date(body.clockIn),
        clockOut: body.clockOut ? new Date(body.clockOut) : null,
        totalHours: body.totalHours,
        date: new Date(body.date),
        mileage: body.mileage,
        notes: body.notes,
        status: body.status || 'active'
      },
      include: {
        staff: true
      }
    });
    
    console.log(`✅ Created timesheet entry for ${shift.staff.firstName} ${shift.staff.lastName}`);
    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating timesheet entry:', error);
    return NextResponse.json(
      { error: 'Failed to create timesheet entry' },
      { status: 500 }
    );
  }
}