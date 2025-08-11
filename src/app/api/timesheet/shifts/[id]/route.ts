import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    console.log(`📊 Fetching shift: ${id}`)
    
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        staff: true,
        reimbursements: true,
        tasks: true
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
    console.error('❌ Error fetching shift:', error)
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
    const body = await request.json()
    
    console.log(`📝 Updating shift: ${id}`, body)
    
    const updateData: any = {}
    
    if (body.clockIn) updateData.clockIn = new Date(body.clockIn)
    if (body.clockOut) updateData.clockOut = new Date(body.clockOut)
    if (body.mileage !== undefined) updateData.mileage = parseFloat(body.mileage) || null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.status) updateData.status = body.status
    
    // Calculate total hours if both clock in and out are provided
    if (body.clockIn && body.clockOut) {
      const clockIn = new Date(body.clockIn)
      const clockOut = new Date(body.clockOut)
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
      updateData.totalHours = parseFloat(totalHours.toFixed(2))
    }
    
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        staff: true,
        reimbursements: true
      }
    })
    
    console.log(`✅ Updated shift: ${id}`)
    return NextResponse.json(updatedShift)
  } catch (error) {
    console.error('❌ Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
} 