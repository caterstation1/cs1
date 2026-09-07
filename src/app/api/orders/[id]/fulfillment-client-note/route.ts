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
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const fulfillmentClientNote =
      typeof body.fulfillmentClientNote === 'string' ? body.fulfillmentClientNote : null
    const existing = await prisma.order.findUnique({
      where: { id },
      select: { fulfillmentClientNote: true, hasLocalEdits: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        fulfillmentClientNote,
        hasLocalEdits: true,
      },
    })

    const session = await getServerSession(authOptions).catch(() => null)
    const changes = buildOrderChangeEntries(
      existing as unknown as Record<string, unknown>,
      {
        fulfillmentClientNote: updatedOrder.fulfillmentClientNote,
        hasLocalEdits: updatedOrder.hasLocalEdits,
      },
      ['fulfillmentClientNote', 'hasLocalEdits']
    )
    await writeOrderChangeLog({
      orderId: id,
      action: 'ORDER_FULFILLMENT_NOTE_UPDATED',
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
    console.error('Error updating fulfillment client note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}
