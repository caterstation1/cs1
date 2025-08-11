import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('📊 Fetching shifts from database...')
    
    const shifts = await prisma.shift.findMany({
      include: {
        staff: true,
        reimbursements: true,
        tasks: true
      },
      orderBy: {
        date: 'desc'
      }
    })
    
    console.log(`✅ Found ${shifts.length} shifts`)
    return NextResponse.json(shifts)
  } catch (error) {
    console.error('❌ Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('📝 Creating new shift:', body)
    
    const shift = await prisma.shift.create({
      data: {
        staffId: body.staffId || 'system', // TODO: Get from auth context
        clockIn: new Date(body.clockIn || new Date()),
        date: new Date(body.date || new Date()),
        status: 'active'
      },
      include: {
        staff: true,
        reimbursements: true
      }
    })
    
    console.log(`✅ Created shift: ${shift.id}`)
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
} 