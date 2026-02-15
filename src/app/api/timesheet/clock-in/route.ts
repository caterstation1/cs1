import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Clocking in...')
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = await prisma.staff.findUnique({ where: { email } })
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // Check if there's already an active shift for this staff
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null,
        status: 'active'
      }
    })
    
    if (activeShift) {
      return NextResponse.json(
        { error: 'Already clocked in. Please clock out first.' },
        { status: 400 }
      )
    }
    
    // Create new shift
    const shift = await prisma.shift.create({
      data: {
        staffId: staff.id,
        clockIn: new Date(),
        date: new Date(),
        status: 'active'
      },
      include: {
        staff: true
      }
    })
    
    console.log(`✅ Clocked in successfully: ${shift.id}`)
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('❌ Error clocking in:', error)
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
} 