// One ingredient's supplier links and price history — the supplier popover and
// the sparkline behind it.

import { NextRequest, NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const historyLimit = Math.min(Number(searchParams.get('history')) || 30, 200)

  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    select: {
      id: true, name: true, canonicalUnit: true, status: true, notes: true,
      hasGluten: true, hasDairy: true, hasNuts: true, hasEgg: true,
      hasSoy: true, hasSesame: true, hasOnionGarlic: true,
      isVegetarian: true, isVegan: true, isHalal: true,
      links: {
        orderBy: { rank: 'asc' },
        select: {
          id: true, source: true, sourceId: true, rank: true, active: true,
          unitsPerPack: true, sizePerUnit: true, sizeUnit: true,
          packVerified: true, packConfidence: true,
          pricePoints: {
            orderBy: { effectiveAt: 'desc' },
            take: historyLimit,
            select: { id: true, packPrice: true, unitCost: true, source: true, effectiveAt: true },
          },
        },
      },
    },
  })

  if (!ingredient) return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 })

  const links = ingredient.links.map((link) => {
    const latest = link.pricePoints[0] ?? null
    return {
      ...link,
      latestUnitCost: latest?.unitCost ?? null,
      latestAsOf: latest?.effectiveAt ?? null,
      // Oldest first, so a sparkline reads left to right.
      history: [...link.pricePoints].reverse(),
    }
  })

  return NextResponse.json({ ...ingredient, links })
}
