// The operator's working surface: every ingredient they could be asked to
// price, most-used first, with our price beside theirs.
//
// Deliberately not the supplier catalogues. Those run to thousands of rows,
// most of which we have never bought — an operator only needs the ingredients
// our recipes actually reference, plus the hand-curated Other list.

import { NextRequest, NextResponse } from 'next/server'
import { collectIngredientUsage, loadSheetEntries } from '@/lib/pricing/pricesheet'
import { buildCostIndex } from '@/lib/pricing/resolve'
import { requireLabRole } from '../authz'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sheetId = searchParams.get('sheetId')

  try {
    // The index is built *without* the overlay here: this screen has to show
    // our price and theirs side by side, so the house cost must survive.
    const [index, entries] = await Promise.all([buildCostIndex(), loadSheetEntries(sheetId)])

    const bySheetKey = new Map(entries.map((e) => [`${e.source}:${e.sourceId}`, e]))
    const usage = collectIngredientUsage(index)

    const ingredients = usage.map((row) => {
      const own = bySheetKey.get(row.key)
      return {
        ...row,
        // Prefill the operator's inputs from the pack we parsed, so a typical
        // row needs a price typed and nothing else.
        yours: own
          ? {
              supplierName: own.supplierName ?? null,
              packPrice: own.packPrice,
              unitsPerPack: own.unitsPerPack,
              sizePerUnit: own.sizePerUnit,
              sizeUnit: own.sizeUnit,
            }
          : null,
      }
    })

    return NextResponse.json({
      ingredients,
      counts: {
        total: ingredients.length,
        priced: ingredients.filter((i) => i.yours).length,
        missingHousePrice: ingredients.filter((i) => i.unitCost == null).length,
      },
    })
  } catch (error) {
    console.error('❌ /api/pricing/lab/ingredients failed:', error)
    return NextResponse.json({ error: 'Failed to load ingredients' }, { status: 500 })
  }
}
