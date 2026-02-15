import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNZDateRangeForYmd, parseLocalDate } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const singleDateStr = searchParams.get('date')
    const status = searchParams.get('status') // 'active' | 'completed'
    const staffId = searchParams.get('staffId')

    const where: any = {}
    // Date filtering (Auckland-local boundaries)
    if (singleDateStr) {
      const { start, end } = getNZDateRangeForYmd(singleDateStr)
      where.date = { gte: start, lte: end }
    } else if (startDateStr || endDateStr) {
      if (startDateStr && endDateStr) {
        const s = getNZDateRangeForYmd(startDateStr).start
        const e = getNZDateRangeForYmd(endDateStr).end
        where.date = { gte: s, lte: e }
      } else if (startDateStr) {
        const s = getNZDateRangeForYmd(startDateStr).start
        where.date = { gte: s }
      } else if (endDateStr) {
        const e = getNZDateRangeForYmd(endDateStr).end
        where.date = { lte: e }
      }
    }

    if (status === 'active') {
      where.clockOut = null
      where.status = 'active'
    } else if (status === 'completed') {
      where.status = 'completed'
    }

    if (staffId) where.staffId = staffId

    const shifts = await prisma.shift.findMany({
      where,
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