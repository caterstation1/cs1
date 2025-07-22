import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const assignments = await prisma.rosterAssignment.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        },
        shiftType: true
      },
      orderBy: [
        { date: 'asc' },
        { staff: { firstName: 'asc' } }
      ]
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error fetching roster assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster assignments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    console.log('Creating roster assignment with data:', data)
    
    // Check if assignment already exists for this staff and date
    const existingAssignment = await prisma.rosterAssignment.findFirst({
      where: {     staffId: data.staffId,
        date: new Date(data.date)
      }
    })

    let assignment
    if (existingAssignment) {
      console.log('Assignment already exists, updating...')
      // Update existing assignment
      assignment = await prisma.rosterAssignment.update({
        where: { id: existingAssignment.id },
        data: {     shiftTypeId: data.shiftTypeId || null,
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          notes: data.notes,
          assignedBy: 'system' // TODO: Get from session when auth is enabled
        },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true
            }
          },
          shiftType: true
        }
      })
    } else {
      console.log('Creating new assignment...')
      // Create new assignment
      assignment = await prisma.rosterAssignment.create({
        data: {     staffId: data.staffId,
          shiftTypeId: data.shiftTypeId || null,
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          date: new Date(data.date),
          notes: data.notes,
          assignedBy: 'system' // TODO: Get from session when auth is enabled
        },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true
            }
          },
          shiftType: true
        }
      })
    }

    console.log('Assignment saved:', assignment)
    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error creating/updating roster assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create/update roster assignment' },
      { status: 500 }
    )
  }
} 