import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        staff: true,
        reimbursements: true
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error fetching shift:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        clockIn: data.clockIn ? new Date(data.clockIn) : undefined,
        clockOut: data.clockOut ? new Date(data.clockOut) : undefined,
        totalHours: data.totalHours,
        mileage: data.mileage,
        notes: data.notes,
        status: data.status
      },
      include: {
        staff: true,
        reimbursements: true
      }
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
} 