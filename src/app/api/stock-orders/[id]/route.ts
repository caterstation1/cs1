import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await prisma.stockOrder.findUnique({ where: { id }, include: { items: true } })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(order)
  } catch (e) {
    console.error('GET /api/stock-orders/[id] failed', e)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status } = body || {}
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })
    const order = await prisma.stockOrder.update({ where: { id }, data: { status }, include: { items: true } })
    // Auto-archive linked message when received
    if (status === 'received') {
      await prisma.wLGMessage.updateMany({ where: { stockOrderId: id, status: { not: 'archived' } }, data: { status: 'archived', statusChangedAt: new Date() } })
    }
    return NextResponse.json(order)
  } catch (e) {
    console.error('PATCH /api/stock-orders/[id] failed', e)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}



