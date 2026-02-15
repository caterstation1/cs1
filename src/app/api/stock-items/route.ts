import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.stockItem.findMany({
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error('GET /api/stock-items failed', e)
    return NextResponse.json({ error: 'Failed to fetch stock items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, supplierId, priceExGst, sku, isActive } = body || {}
    if (!name || !supplierId || priceExGst === undefined) {
      return NextResponse.json({ error: 'name, supplierId and priceExGst are required' }, { status: 400 })
    }
    // validate supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 400 })

    const item = await prisma.stockItem.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        supplierId: String(supplierId),
        sku: sku ? String(sku) : null,
        priceExGst: Number(priceExGst),
        isActive: isActive !== false
      },
      include: { supplier: { select: { id: true, name: true } } }
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('POST /api/stock-items failed', e)
    return NextResponse.json({ error: 'Failed to create stock item' }, { status: 500 })
  }
}


