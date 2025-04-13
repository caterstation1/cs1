import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST() {
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

    // Find the active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null
      }
    })

    if (!activeShift) {
      return NextResponse.json(
        { error: 'No active shift found' },
        { status: 400 }
      )
    }

    // Calculate total hours
    const clockOut = new Date()
    const clockIn = new Date(activeShift.clockIn)
    const totalHours = Math.round((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) * 100) / 100

    // Update the shift
    const shift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        clockOut,
        totalHours
      }
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error clocking out:', error)
    return NextResponse.json(
      { error: 'Failed to clock out' },
      { status: 500 }
    )
  }
} 