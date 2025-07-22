import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        reimbursements: true
      },
      orderBy: {
        date: 'desc'
      }
    })

    return NextResponse.json(shifts)
  } catch (error) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const shift = await prisma.shift.create({
      data: {
        staffId: data.staffId, // TODO: Get from session when auth is enabled
        clockIn: new Date(data.clockIn),
        date: new Date(data.date),
        status: 'active'
      },
      include: {
        reimbursements: true
      }
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
} 