import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildOrderChangeEntries, writeOrderChangeLog } from '@/lib/order-change-log'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { internalNote } = await request.json()
    
    const { id } = await params
    const existing = await prisma.order.findUnique({
      where: { id },
      select: { internalNote: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { internalNote }
    })

    const session = await getServerSession(authOptions).catch(() => null)
    const changes = buildOrderChangeEntries(
      { internalNote: existing.internalNote },
      { internalNote: updatedOrder.internalNote },
      ['internalNote']
    )
    await writeOrderChangeLog({
      orderId: id,
      action: 'ORDER_INTERNAL_NOTE_UPDATED',
      changes,
      actor: session?.user
        ? {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
          }
        : undefined,
      source: new URL(request.url).pathname,
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