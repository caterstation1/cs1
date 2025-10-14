import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateString = searchParams.get('date')

    if (!dateString) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
    }

    // Parse the date string (YYYY-MM-DD format)
    const targetDate = new Date(dateString)
    
    // Set to start of day
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    // Set to end of day
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Fetch roster assignments for the specific date
    const assignments = await prisma.rosterAssignment.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        staff: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        shiftType: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: [
        { startTime: 'asc' },
        { staff: { firstName: 'asc' } },
      ],
    })

    // Format the response
    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      firstName: assignment.staff.firstName,
      lastName: assignment.staff.lastName,
      // Use custom times if provided, otherwise fall back to shift type times
      startTime: assignment.startTime || assignment.shiftType?.startTime || '',
      endTime: assignment.endTime || assignment.shiftType?.endTime || '',
      shiftTypeName: assignment.shiftType?.name || 'Custom',
      notes: assignment.notes,
    }))

    return NextResponse.json({ assignments: formattedAssignments })
  } catch (error) {
    console.error('Error fetching roster assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster assignments' },
      { status: 500 }
    )
  }
}

