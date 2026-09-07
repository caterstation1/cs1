// Left panel of the Recipe Builder: sellable products with live margin, and
// components with their cost per output unit.
//
// One index build serves the whole list, so this is a single pass rather than
// a query per row.

import { NextRequest, NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { CostResult, costComponent, costVariant, marginFor } from '@/lib/pricing/cost'
import { buildCostIndex } from '@/lib/pricing/resolve'

export const maxDuration = 300

export interface CatalogProduct {
  id: string
  name: string
  sku: string | null
  cost: number | null
  rrpInclGst: number
  margin: number | null
  belowTarget: boolean
  coveragePct: number
}

export interface CatalogComponent {
  id: string
  name: string
  perUnit: number | null
  unit: string
  batchCost: number | null
  coveragePct: number
}

export async function GET(request: NextRequest) {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  try {
    const index = await buildCostIndex()
    const cache = new Map<string, CostResult>()
    const { targetMargin, gstRate } = index.settings

    const products: CatalogProduct[] = []
    for (const variant of index.variantsByVariantId.values()) {
      if (q && !variant.name.toLowerCase().includes(q)) continue
      const result = costVariant(variant.variantId, index, { cache })
      const { margin } = marginFor(result.total, variant.shopifyPriceInclGst, gstRate, targetMargin)
      products.push({
        id: variant.variantId,
        name: variant.name,
        sku: variant.sku,
        cost: result.total,
        rrpInclGst: variant.shopifyPriceInclGst,
        margin,
        belowTarget: margin != null && margin < targetMargin,
        coveragePct: result.coverage.pct,
      })
    }

    const components: CatalogComponent[] = []
    for (const [id, component] of index.components) {
      if (q && !component.name.toLowerCase().includes(q)) continue
      const result = costComponent(id, index, { cache })
      components.push({
        id,
        name: component.name,
        perUnit: result.perUnit,
        unit: result.unit,
        batchCost: result.total,
        coveragePct: result.coverage.pct,
      })
    }

    // Priced first — an uncosted row is the least useful thing to open — then
    // worst margin first, so the products that need attention are at the top.
    products.sort(
      (a, b) =>
        Number(b.margin != null) - Number(a.margin != null) ||
        (a.margin ?? 0) - (b.margin ?? 0) ||
        a.name.localeCompare(b.name)
    )
    components.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      products,
      components,
      settings: { targetMargin, gstRate },
      counts: {
        products: products.length,
        components: components.length,
        productsBelowTarget: products.filter((p) => p.belowTarget).length,
      },
    })
  } catch (error) {
    console.error('❌ /api/pricing/catalog failed:', error)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}
