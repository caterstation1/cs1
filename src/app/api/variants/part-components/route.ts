import { NextRequest, NextResponse } from 'next/server'
import { recalcAll } from '@/lib/pricing/recalc'
import {
  applyPartComponentOp,
  getAlignment,
  missingAlignedRows,
  normalizeRows,
  summariseStoredItems,
  variantsForPart,
} from '@/lib/variant-part-components'

// A part can span hundreds of variants, and the write is followed by a
// whole-catalogue reprice so live costing stays correct.
export const maxDuration = 300

/** What is stored on a part's variants today, plus what it is aligned to. */
export async function GET(request: NextRequest) {
  try {
    const partName = (new URL(request.url).searchParams.get('partName') || '').trim()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })

    const [variants, aligned] = await Promise.all([variantsForPart(partName), getAlignment(partName)])
    const storedItems = summariseStoredItems(variants)

    const variantsMissingAligned = variants
      .map((v) => ({ variant: v, missing: missingAlignedRows(v.ingredients, aligned) }))
      .filter((row) => row.missing.length > 0)

    return NextResponse.json({
      partName,
      variantCount: variants.length,
      storedItems,
      aligned,
      alignmentGap: {
        variantsMissing: variantsMissingAligned.length,
        detail: variantsMissingAligned.slice(0, 25).map((row) => ({
          variantId: row.variant.variantId,
          shopifyName: row.variant.shopifyName,
          productTitle: row.variant.productTitle,
          missing: row.missing.map((m) => m.name),
        })),
      },
    })
  } catch (error) {
    console.error('part-components GET error', error)
    return NextResponse.json({ error: 'Failed to load part components' }, { status: 500 })
  }
}

/** Add or remove stored items across every variant carrying the part. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const partName = String(body?.partName || '').trim()
    const op = String(body?.op || 'add').toLowerCase()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })
    if (op !== 'add' && op !== 'remove') {
      return NextResponse.json({ error: "op must be 'add' or 'remove'" }, { status: 400 })
    }

    const items = normalizeRows(body?.items)
    if (items.length === 0) return NextResponse.json({ error: 'items[] is required' }, { status: 400 })

    const result = await applyPartComponentOp(partName, op, items)

    // Costing prefers the live ProductVariant.totalCost, so stored-item changes
    // must be repriced or the dashboard would keep the previous cost.
    let recalc: { variants: number; components: number } | null = null
    if (result.variantsChanged > 0) {
      try {
        const report = await recalcAll('manual')
        recalc = { variants: report.variants.updated, components: report.components.updated }
      } catch (e) {
        console.error('recalc after part component change failed', e)
      }
    }

    return NextResponse.json({ ...result, recalc })
  } catch (error) {
    console.error('part-components POST error', error)
    return NextResponse.json({ error: 'Failed to update part components' }, { status: 500 })
  }
}
