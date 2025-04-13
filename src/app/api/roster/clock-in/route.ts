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

    // Check if there's already an active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null
      }
    })

    if (activeShift) {
      return NextResponse.json(
        { error: 'Already clocked in' },
        { status: 400 }
      )
    }

    // Create a new shift
    const shift = await prisma.shift.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        date: new Date(),
      }
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error clocking in:', error)
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
} 