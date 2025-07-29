import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log('📅 Fetching roster assignments from PostgreSQL...');
    
    let whereClause = {};
    if (startDate && endDate) {
      whereClause = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    }
    
    const assignments = await prisma.rosterAssignment.findMany({
      where: whereClause,
      include: {
        staff: true,
        shiftType: true
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${assignments.length} roster assignments`);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('❌ Error fetching roster assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roster assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const assignment = await prisma.rosterAssignment.create({
      data: {
        staffId: body.staffId,
        shiftTypeId: body.shiftTypeId,
        startTime: body.startTime,
        endTime: body.endTime,
        date: new Date(body.date),
        notes: body.notes,
        assignedBy: body.assignedBy
      },
      include: {
        staff: true,
        shiftType: true
      }
    });
    
    console.log(`✅ Created roster assignment for ${assignment.staff.firstName} ${assignment.staff.lastName}`);
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating roster assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create roster assignment' },
      { status: 500 }
    );
  }
} 