import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeRows } from '@/lib/variant-part-components'

// A variant part's alignment is the item(s) that part is supposed to carry.
// Verify & Fix All reads it to add the item to every variant missing it.

/** One part's alignment, or all of them when no partName is given. */
export async function GET(request: NextRequest) {
  try {
    const partName = (new URL(request.url).searchParams.get('partName') || '').trim()

    if (partName) {
      const record = await prisma.variantPartAlignment.findUnique({ where: { partName } })
      return NextResponse.json({
        partName,
        items: record ? normalizeRows(record.items) : [],
        notes: record?.notes ?? null,
        updatedAt: record?.updatedAt ?? null,
      })
    }

    const records = await prisma.variantPartAlignment.findMany({ orderBy: { partName: 'asc' } })
    return NextResponse.json({
      alignments: records.map((r) => ({
        partName: r.partName,
        items: normalizeRows(r.items),
        notes: r.notes,
        updatedAt: r.updatedAt,
      })),
    })
  } catch (error) {
    console.error('alignment GET error', error)
    return NextResponse.json({ error: 'Failed to load alignments' }, { status: 500 })
  }
}

/** Set (or clear) the items a part is aligned to. */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const partName = String(body?.partName || '').trim()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })

    const items = normalizeRows(body?.items)
    const notes = body?.notes ? String(body.notes) : null

    if (items.length === 0) {
      await prisma.variantPartAlignment.deleteMany({ where: { partName } })
      return NextResponse.json({ partName, items: [], cleared: true })
    }

    const record = await prisma.variantPartAlignment.upsert({
      where: { partName },
      create: { partName, items: items as any, notes },
      update: { items: items as any, notes },
    })

    return NextResponse.json({ partName, items: normalizeRows(record.items), notes: record.notes })
  } catch (error) {
    console.error('alignment PUT error', error)
    return NextResponse.json({ error: 'Failed to save alignment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const partName = (new URL(request.url).searchParams.get('partName') || '').trim()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })
    await prisma.variantPartAlignment.deleteMany({ where: { partName } })
    return NextResponse.json({ partName, cleared: true })
  } catch (error) {
    console.error('alignment DELETE error', error)
    return NextResponse.json({ error: 'Failed to clear alignment' }, { status: 500 })
  }
}
