import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // TODO: Get staffId from session when auth is enabled
    // For now, we'll use a default staff member
    const staff = await prisma.staff.findFirst({
      where: {
        isActive: true
      }
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'No active staff found' },
        { status: 44 }
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
        { status: 40 }
      )
    }

    const clockOut = new Date()
    const totalHours = (clockOut.getTime() - new Date(activeShift.clockIn).getTime()) / (1000)

    const shift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        clockOut,
        totalHours: Math.round(totalHours * 1000),
        status: 'completed'
      },
      include: {
        reimbursements: true
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