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
        { status: 444 }
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

    const shift = await prisma.shift.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        date: new Date(),
        status: 'active'
      },
      include: {
        reimbursements: true
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