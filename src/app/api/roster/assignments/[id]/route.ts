import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🔍 Fetching roster assignment ${id} from PostgreSQL...`);
    
    const assignment = await prisma.rosterAssignment.findUnique({
      where: { id },
      include: {
        staff: true,
        shiftType: true
      }
    });
    
    if (!assignment) {
      return NextResponse.json(
        { error: 'Roster assignment not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Found roster assignment for ${assignment.staff.firstName} ${assignment.staff.lastName}`);
    return NextResponse.json(assignment);
  } catch (error) {
    console.error('❌ Error fetching roster assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roster assignment' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🔄 Updating roster assignment ${id} in PostgreSQL...`);
    
    const assignment = await prisma.rosterAssignment.update({
      where: { id },
      data: {
        staffId: body.staffId,
        shiftTypeId: body.shiftTypeId,
        startTime: body.startTime,
        endTime: body.endTime,
        date: body.date ? new Date(body.date) : undefined,
        notes: body.notes,
        assignedBy: body.assignedBy
      },
      include: {
        staff: true,
        shiftType: true
      }
    });
    
    console.log(`✅ Updated roster assignment for ${assignment.staff.firstName} ${assignment.staff.lastName}`);
    return NextResponse.json(assignment);
  } catch (error) {
    console.error('❌ Error updating roster assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update roster assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Deleting roster assignment ${id} from PostgreSQL...`);
    
    await prisma.rosterAssignment.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted roster assignment: ${id}`);
    return NextResponse.json({ message: 'Roster assignment deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting roster assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete roster assignment' },
      { status: 500 }
    );
  }
} 