import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, createdBy, createdByName } = body || {}
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })
    if (!createdBy || !createdByName) return NextResponse.json({ error: 'createdBy and createdByName required' }, { status: 400 })

    // Load stock items referenced and compute totals
    const itemIds = items.map((i: any) => String(i.stockItemId))
    const records = await prisma.stockItem.findMany({ where: { id: { in: itemIds } }, include: { supplier: true } })
    const byId = new Map(records.map(r => [r.id, r]))
    let subtotal = 0
    const orderItemsData: any[] = []
    for (const it of items) {
      const rec = byId.get(String(it.stockItemId))
      if (!rec) continue
      const qty = Math.max(1, parseInt(String(it.qty || '1'), 10))
      const unit = Number(rec.priceExGst as any)
      const line = unit * qty
      subtotal += line
      orderItemsData.push({
        stockItemId: rec.id,
        nameSnapshot: rec.name,
        supplierNameSnapshot: rec.supplier?.name || '',
        unitPriceExGst: unit,
        qty,
        lineTotalExGst: line
      })
    }
    if (orderItemsData.length === 0) return NextResponse.json({ error: 'No valid items' }, { status: 400 })
    const gst = Math.round(subtotal * 0.15 * 100) / 100
    const total = Math.round((subtotal + gst) * 100) / 100

    // Create order and message
    const order = await prisma.stockOrder.create({
      data: {
        createdBy: String(createdBy),
        createdByName: String(createdByName),
        status: 'new',
        subtotalExGst: subtotal.toFixed(2),
        gst15: gst.toFixed(2),
        totalIncGst: total.toFixed(2),
        items: { create: orderItemsData }
      }
    })

    const summaryLines = orderItemsData.map(i => `- ${i.qty} x ${i.nameSnapshot} @ $${i.unitPriceExGst} = $${i.lineTotalExGst}`)
    const content = `WLG Stock Order\n\n${summaryLines.join('\n')}\n\nSubtotal (ex GST): $${subtotal}\nGST 15%: $${gst}\nTotal (inc GST): $${total}`
    const message = await prisma.wLGMessage.create({
      data: {
        content,
        createdBy: String(createdBy),
        createdByName: String(createdByName),
        status: 'new',
        stockOrderId: order.id
      }
    })

    return NextResponse.json({ orderId: order.id, messageId: message.id }, { status: 201 })
  } catch (e) {
    console.error('POST /api/stock-orders failed', e)
    return NextResponse.json({ error: 'Failed to create stock order' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const orders = await prisma.stockOrder.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    })
    return NextResponse.json(orders)
  } catch (e) {
    console.error('GET /api/stock-orders failed', e)
    return NextResponse.json({ error: 'Failed to fetch stock orders' }, { status: 500 })
  }
}


