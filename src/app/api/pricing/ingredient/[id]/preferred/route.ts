// Switch which supplier link is preferred for an ingredient.
//
// Rank 1 is what the engine costs from, so this changes every recipe using the
// ingredient. The response says which products moved and by how much.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { CostResult, costVariant, marginFor } from '@/lib/pricing/cost'
import { buildCostIndex } from '@/lib/pricing/resolve'

export const maxDuration = 300

const bodySchema = z.object({ linkId: z.string().min(1) })

async function snapshot() {
  const index = await buildCostIndex()
  const cache = new Map<string, CostResult>()
  const snap = new Map<string, { name: string; cost: number | null; margin: number | null; pk: string; rrp: number }>()
  for (const v of index.variantsByVariantId.values()) {
    const r = costVariant(v.variantId, index, { cache })
    const { margin } = marginFor(r.total, v.shopifyPriceInclGst, index.settings.gstRate, index.settings.targetMargin)
    snap.set(v.variantId, { name: v.name, cost: r.total, margin, pk: v.id, rrp: v.shopifyPriceInclGst })
  }
  return snap
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getAccessLevel()
  if (!role || (role !== 'admin' && role !== 'owner' && role !== 'pricing_lab')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'linkId is required' }, { status: 400 })

  try {
    const links = await prisma.ingredientSupplierLink.findMany({
      where: { ingredientId: id },
      orderBy: { rank: 'asc' },
      select: { id: true, source: true, sourceId: true, rank: true },
    })
    if (!links.length) return NextResponse.json({ error: 'Ingredient has no supplier links' }, { status: 404 })
    if (!links.some((l) => l.id === parsed.data.linkId)) {
      return NextResponse.json({ error: 'That link does not belong to this ingredient' }, { status: 400 })
    }

    const before = await snapshot()

    // Chosen link becomes rank 1; the rest keep their relative order below it.
    const others = links.filter((l) => l.id !== parsed.data.linkId)
    await prisma.$transaction([
      prisma.ingredientSupplierLink.update({ where: { id: parsed.data.linkId }, data: { rank: 1 } }),
      ...others.map((l, i) => prisma.ingredientSupplierLink.update({ where: { id: l.id }, data: { rank: i + 2 } })),
    ])

    const index = await buildCostIndex()
    const cache = new Map<string, CostResult>()
    const impact = []
    for (const v of index.variantsByVariantId.values()) {
      const r = costVariant(v.variantId, index, { cache })
      const was = before.get(v.variantId)
      if (!was) continue
      if (Math.abs((r.total ?? 0) - (was.cost ?? 0)) <= 0.005) continue
      const { margin } = marginFor(r.total, v.shopifyPriceInclGst, index.settings.gstRate, index.settings.targetMargin)
      impact.push({
        id: v.variantId,
        name: v.name,
        costBefore: was.cost,
        costAfter: r.total,
        marginBefore: was.margin,
        marginAfter: margin,
      })
      if (r.total != null) {
        await prisma.productVariant.update({ where: { id: v.id }, data: { totalCost: r.total } })
      }
    }

    const updated = await prisma.ingredientSupplierLink.findMany({
      where: { ingredientId: id },
      orderBy: { rank: 'asc' },
      select: {
        id: true, source: true, sourceId: true, rank: true, packConfidence: true,
        pricePoints: { orderBy: { effectiveAt: 'desc' }, take: 1, select: { unitCost: true, effectiveAt: true } },
      },
    })

    return NextResponse.json({ success: true, links: updated, impact })
  } catch (error) {
    console.error('❌ /api/pricing/ingredient/preferred failed:', error)
    return NextResponse.json({ error: 'Failed to switch preferred supplier' }, { status: 500 })
  }
}
