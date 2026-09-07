// The fully expanded, costed recipe tree for one product or component.

import { NextRequest, NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { buildCostIndex } from '@/lib/pricing/resolve'
import { OwnerType, buildRecipeTree, loadIngredientFlags } from '@/lib/pricing/tree'

export const maxDuration = 300

export async function GET(_request: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id } = await params
  if (type !== 'product' && type !== 'component') {
    return NextResponse.json({ error: "type must be 'product' or 'component'" }, { status: 400 })
  }

  try {
    const [index, ingredientFlags] = await Promise.all([buildCostIndex(), loadIngredientFlags()])

    // `serves` is not a column; the variant option carries it where it exists.
    let serves: number | null = null
    // Variant alerts are keyed on the row's primary key, but this route is
    // addressed by the Shopify variant id. Both are needed to find them.
    let variantPk: string | null = null
    if (type === 'product') {
      const variant = await prisma.productVariant.findFirst({
        where: { variantId: id },
        select: { id: true, option1: true, option2: true, shopifyTitle: true },
      })
      variantPk = variant?.id ?? null
      const haystack = [variant?.option1, variant?.option2, variant?.shopifyTitle].filter(Boolean).join(' ')
      const match = haystack.match(/(\d+)\s*(?:-\s*\d+\s*)?(?:ppl|people|serves|pax)/i)
      if (match) serves = Number(match[1])
    }

    const tree = buildRecipeTree(type as OwnerType, id, index, { ingredientFlags, serves })
    if (!tree) return NextResponse.json({ error: `No ${type} with id ${id}` }, { status: 404 })

    // Alerts relevant to what is open: this item, and any ingredient in it.
    const ingredientIds = new Set<string>()
    const walk = (nodes: typeof tree.nodes) => {
      for (const n of nodes) {
        if (n.ingredientId) ingredientIds.add(n.ingredientId)
        if (n.children) walk(n.children)
      }
    }
    walk(tree.nodes)

    const ownRefIds = [id, ...(variantPk ? [variantPk] : [])]
    const alerts = await prisma.priceAlert.findMany({
      where: { status: 'open', refId: { in: [...ownRefIds, ...ingredientIds] } },
      select: { id: true, type: true, refType: true, refId: true, message: true },
      take: 50,
    })

    return NextResponse.json({ ...tree, alerts })
  } catch (error) {
    console.error('❌ /api/pricing/recipe failed:', error)
    return NextResponse.json({ error: 'Failed to build recipe tree' }, { status: 500 })
  }
}
