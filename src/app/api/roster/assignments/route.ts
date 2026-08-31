import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyRosterAssignmentCreated } from '@/lib/roster-assignment-alert'

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

    console.log('📅 Fetching roster assignments from', startDate, 'to', endDate)
    
    const assignments = await prisma.rosterAssignment.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      include: {
        staff: true,
        shiftType: true,
        tasks: true
      },
      orderBy: {
        date: 'asc'
      }
    })
    
    console.log(`✅ Found ${assignments.length} roster assignments`)
    return NextResponse.json(assignments)
  } catch (error) {
    console.error('❌ Error fetching roster assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster assignments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('📝 Creating roster assignment:', body)
    
    const assignment = await prisma.rosterAssignment.create({
      data: {
        staffId: body.staffId,
        shiftTypeId: body.shiftTypeId || null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        date: new Date(body.date),
        notes: body.notes || null,
        assignedBy: 'system', // TODO: Get from auth context
        tasks: {
          create: body.tasks?.map((task: any) => ({
            title: task.title,
            description: task.description || null
          })) || []
        }
      },
      include: {
        staff: true,
        shiftType: true,
        tasks: true
      }
    })
    
    console.log(`✅ Created roster assignment: ${assignment.id}`)

    // Both the Roster page and the calendar Roster drawer post here, so alerting
    // from this one place keeps the two entry points behaving identically.
    // notifyRosterAssignmentCreated never throws — a notification problem must
    // not turn a saved shift into a failed request.
    const alertOutcome = await notifyRosterAssignmentCreated(assignment)
    if (alertOutcome.status === 'failed') {
      console.error(`[roster-alert] ${assignment.id} failed: ${alertOutcome.reason}`)
    } else if (alertOutcome.status !== 'disabled') {
      console.log(`[roster-alert] ${assignment.id} ${alertOutcome.status}`, alertOutcome)
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating roster assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create roster assignment' },
      { status: 500 }
    )
  }
} 