import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Clocking in...')
    
    // Check if there's already an active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
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
        staffId: 'system', // TODO: Get from auth context
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