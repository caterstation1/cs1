import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Clocking out...')
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const staff = await prisma.staff.findUnique({ where: { email } })
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    // Find the active shift for this staff
    const activeShift = await prisma.shift.findFirst({
      where: {
        staffId: staff.id,
        clockOut: null,
        status: 'active'
      }
    })
    
    if (!activeShift) {
      return NextResponse.json(
        { error: 'No active shift found. Please clock in first.' },
        { status: 400 }
      )
    }
    
    const clockOutTime = new Date()
    const totalHours = (clockOutTime.getTime() - activeShift.clockIn.getTime()) / (1000 * 60 * 60)
    
    // Update the shift
    const updatedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        clockOut: clockOutTime,
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: 'completed'
      },
      include: {
        staff: true,
        reimbursements: true
      }
    })
    
    console.log(`✅ Clocked out successfully: ${updatedShift.id} (${totalHours.toFixed(2)} hours)`)
    return NextResponse.json(updatedShift)
  } catch (error) {
    console.error('❌ Error clocking out:', error)
    return NextResponse.json(
      { error: 'Failed to clock out' },
      { status: 500 }
    )
  }
} 