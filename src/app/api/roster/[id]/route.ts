import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the current user's session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the staff member
    const staff = await prisma.staff.findUnique({
      where: { email: session.user.email }
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    // Get the shift ID from the URL
    const shiftId = params.id

    // Get the shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Verify the shift belongs to the current user
    if (shift.staffId !== staff.id) {
      return NextResponse.json(
        { error: 'Unauthorized to edit this shift' },
        { status: 403 }
      )
    }

    // Get the request body
    const body = await request.json()
    const { clockIn, clockOut, date } = body

    // Validate the data
    if (!clockIn || !date) {
      return NextResponse.json(
        { error: 'Clock in time and date are required' },
        { status: 400 }
      )
    }

    // Calculate total hours if clock out is provided
    let totalHours = null
    if (clockOut) {
      const clockOutDate = new Date(clockOut)
      const clockInDate = new Date(clockIn)
      totalHours = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60) * 100) / 100
    }

    // Update the shift
    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        clockIn: new Date(clockIn),
        clockOut: clockOut ? new Date(clockOut) : null,
        date: new Date(date),
        totalHours
      }
    })

    return NextResponse.json(updatedShift)
  } catch (error) {
    console.error('Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
} 