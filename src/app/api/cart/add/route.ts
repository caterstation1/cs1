import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const city = String((body.city || 'AKL')).toUpperCase()
    const name = String(body.name || '').trim()
    const supplier = String(body.supplier || 'Other').trim()
    const qty = Number(body.qty || 0)
    const sku = body.sku ? String(body.sku) : null
    const notes = body.notes ? String(body.notes) : null
    if (!name || !qty || qty <= 0) {
      return NextResponse.json({ error: 'name and qty > 0 required' }, { status: 400 })
    }
    // Merge by (city + supplier + sku || name)
    const existing = await prisma.cartItem.findFirst({
      where: {
        city, supplier,
        OR: [
          { sku: sku },
          { AND: [{ sku: null }, { name: name }] }
        ]
      }
    })
    if (existing) {
      const updated = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + qty, notes: notes ?? existing.notes }
      })
      return NextResponse.json(updated, { status: 200 })
    }
    const created = await prisma.cartItem.create({
      data: { city, name, supplier, qty, sku: sku || undefined, notes: notes || undefined }
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('cart add error', e)
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 })
  }
}


