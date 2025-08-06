import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { internalNote } = await request.json()
    
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
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