import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { internalNote } = await request.json()
    
    const { id } = await params
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { internalNote }
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error updating internal note:', error)
    return NextResponse.json(
      { error: 'Failed to update internal note' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await prisma.order.findUnique({
      where: { id },
      select: { internalNote: true }
    })

    return NextResponse.json({ internalNote: order?.internalNote || '' })
  } catch (error) {
    console.error('Error fetching internal note:', error)
    return NextResponse.json(
      { error: 'Failed to fetch internal note' },
      { status: 500 }
    )
  }
} 