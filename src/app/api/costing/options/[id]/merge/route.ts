import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

// Folds one option into another: every spelling moves across and the source
// option disappears. This is how nine ways of writing "Beef Brisket" become
// one costed choice without touching a single variant or the storefront.

interface Ctx {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const intoOptionId = String(body?.intoOptionId ?? '').trim()
    if (!intoOptionId) return NextResponse.json({ error: 'intoOptionId is required' }, { status: 400 })
    if (intoOptionId === id) return NextResponse.json({ error: 'Cannot fold an option into itself' }, { status: 400 })

    const [source, target] = await Promise.all([
      prisma.costingOption.findUnique({ where: { id }, include: { aliases: true } }),
      prisma.costingOption.findUnique({ where: { id: intoOptionId } }),
    ])
    if (!source || !target) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    const moved = [source.name, ...source.aliases.map((a) => a.value)]

    await prisma.$transaction(async (tx) => {
      // Deleting the source first frees its aliases and its unique name, so
      // the canonical spelling can be re-attached to the target.
      await tx.costingOption.delete({ where: { id } })
      for (const value of moved) {
        if (value === target.name) continue
        await tx.costingOptionAlias.deleteMany({ where: { value } })
        await tx.costingOptionAlias.create({ data: { value, optionId: intoOptionId } })
      }
    })

    return NextResponse.json({ merged: true, movedSpellings: moved.length, into: target.name })
  } catch (e) {
    console.error('❌ costing option merge error:', e)
    return NextResponse.json({ error: 'Failed to fold option' }, { status: 500 })
  }
}
