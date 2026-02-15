import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await req.json()
    const updates: any = {}
    if (data.name !== undefined) updates.name = String(data.name)
    if (data.description !== undefined) updates.description = data.description ? String(data.description) : null
    if (data.sku !== undefined) updates.sku = data.sku ? String(data.sku) : null
    if (data.supplierId !== undefined) {
      const sup = await prisma.supplier.findUnique({ where: { id: String(data.supplierId) } })
      if (!sup) return NextResponse.json({ error: 'Supplier not found' }, { status: 400 })
      updates.supplierId = String(data.supplierId)
    }
    if (data.priceExGst !== undefined) updates.priceExGst = Number(data.priceExGst)
    if (data.isActive !== undefined) updates.isActive = !!data.isActive

    const item = await prisma.stockItem.update({ where: { id }, data: updates, include: { supplier: { select: { id: true, name: true } } } })
    return NextResponse.json(item)
  } catch (e) {
    console.error('PATCH /api/stock-items/[id] failed', e)
    return NextResponse.json({ error: 'Failed to update stock item' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.stockItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/stock-items/[id] failed', e)
    return NextResponse.json({ error: 'Failed to delete stock item' }, { status: 500 })
  }
}


