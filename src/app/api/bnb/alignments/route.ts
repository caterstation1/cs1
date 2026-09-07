import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// B&B bakery cost alignments: map a bakery display item to an Other-tab
// product so unpriced bakery items can be costed on the B&B page.

export async function GET() {
  try {
    const alignments = await prisma.bakeryCostAlignment.findMany({
      orderBy: { bakeryItemName: 'asc' },
    })
    const otherIds = Array.from(new Set(alignments.map(a => a.otherProductId)))
    const others = otherIds.length
      ? await prisma.otherProduct.findMany({ where: { id: { in: otherIds } } })
      : []
    const otherById = new Map(others.map(p => [p.id, p]))
    return NextResponse.json({
      alignments: alignments.map(a => ({
        bakeryItemName: a.bakeryItemName,
        otherProductId: a.otherProductId,
        otherProductName: otherById.get(a.otherProductId)?.name ?? null,
        cost: otherById.get(a.otherProductId)?.cost ?? null,
      })),
    })
  } catch (error) {
    console.error('Error fetching bakery alignments:', error)
    return NextResponse.json({ error: 'Failed to fetch alignments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bakeryItemName = String(body.bakeryItemName || '').trim()
    const otherProductId = String(body.otherProductId || '').trim()
    if (!bakeryItemName || !otherProductId) {
      return NextResponse.json(
        { error: 'bakeryItemName and otherProductId are required' },
        { status: 400 }
      )
    }

    const other = await prisma.otherProduct.findUnique({ where: { id: otherProductId } })
    if (!other) {
      return NextResponse.json({ error: 'Other product not found' }, { status: 404 })
    }

    // Optionally update the Other product's cost at the same time
    let cost = other.cost
    if (body.cost !== undefined && body.cost !== null && String(body.cost).trim() !== '') {
      const parsed = parseFloat(String(body.cost))
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Invalid cost' }, { status: 400 })
      }
      if (parsed !== other.cost) {
        await prisma.otherProduct.update({
          where: { id: otherProductId },
          data: { cost: parsed },
        })
      }
      cost = parsed
    }

    const alignment = await prisma.bakeryCostAlignment.upsert({
      where: { bakeryItemName },
      update: { otherProductId },
      create: { bakeryItemName, otherProductId },
    })

    return NextResponse.json({
      alignment: {
        bakeryItemName: alignment.bakeryItemName,
        otherProductId: alignment.otherProductId,
        otherProductName: other.name,
        cost,
      },
    })
  } catch (error) {
    console.error('Error saving bakery alignment:', error)
    return NextResponse.json({ error: 'Failed to save alignment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const bakeryItemName = String(request.nextUrl.searchParams.get('name') || '').trim()
    if (!bakeryItemName) {
      return NextResponse.json({ error: 'name query param is required' }, { status: 400 })
    }
    await prisma.bakeryCostAlignment.deleteMany({ where: { bakeryItemName } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bakery alignment:', error)
    return NextResponse.json({ error: 'Failed to delete alignment' }, { status: 500 })
  }
}
