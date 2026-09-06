import assert from 'node:assert/strict'
import { costVariant } from '../cost'
import {
  applyPriceSheet,
  collectIngredientUsage,
  deriveSheetUnitCost,
  mergeDraftEntries,
} from '../pricesheet'
import { createCostIndex } from '../resolve'

function approx(actual: number | null | undefined, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(actual != null, `${message}: expected ~${expected}, got ${actual}`)
  assert.ok(
    Math.abs((actual as number) - expected) < tolerance,
    `${message}: expected ~${expected}, got ${actual}`
  )
}

function line(source: string, id: string, name: string, quantity: number, unit: string | null, cost = 0) {
  return { source, id, name, quantity, unit, cost }
}

function run() {
  // $48.50 for 6 × 2kg = 12kg → $4.0416…/kg
  {
    const derived = deriveSheetUnitCost({
      packPrice: 48.5,
      unitsPerPack: 6,
      sizePerUnit: 2,
      sizeUnit: 'kg',
    })
    assert.ok(derived)
    approx(derived.unitCost, 48.5 / 12, '6×2kg carton')
    assert.equal(derived.unit, 'kg')
    approx(derived.totalQuantity, 12, 'total kg in the pack')
  }

  // 12 × 500g = 6kg
  {
    const derived = deriveSheetUnitCost({
      packPrice: 30,
      unitsPerPack: 12,
      sizePerUnit: 500,
      sizeUnit: 'g',
    })
    assert.ok(derived)
    approx(derived.unitCost, 5, 'grams convert to kg before dividing')
    assert.equal(derived.unit, 'kg')
  }

  assert.equal(deriveSheetUnitCost({ packPrice: 10, unitsPerPack: 0, sizePerUnit: 1, sizeUnit: 'kg' }), null)
  assert.equal(deriveSheetUnitCost({ packPrice: -1, unitsPerPack: 1, sizePerUnit: 1, sizeUnit: 'each' }), null)

  const unusedGilmours = {
    id: 'gl-unused',
    sku: 'G999',
    description: 'Aisle filler we never buy',
    packSize: '1kg',
    uom: 'KG',
    price: 4,
  }
  const usedGilmours = {
    id: 'gl-gherkin',
    sku: 'G50',
    description: 'Gherkins',
    packSize: '2x2kg',
    uom: 'CTN',
    price: 20,
  }
  const otherUsed = { id: 'ot-box', name: 'Insert card box', supplier: 'Packaging Co', cost: 1.04 }
  const otherUnused = { id: 'ot-napkin', name: 'Napkin', supplier: 'Packaging Co', cost: 0.2 }

  const index = createCostIndex({
    gilmours: [usedGilmours, unusedGilmours],
    other: [otherUsed, otherUnused],
    components: [
      {
        id: 'c-gherkins',
        name: 'gherkins-50',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Gilmours', 'gl-gherkin', 'Gherkins', 100, 'g', 5)],
      },
    ],
    variants: [
      {
        id: 'v-row',
        variantId: 'v1',
        productId: 'p1',
        shopifyName: 'Slider Station',
        shopifyPrice: 46,
        totalCost: 0,
        ingredients: [
          line('Components', 'c-gherkins', 'gherkins-50', 1, 'unit', 0),
          line('Other', 'ot-box', 'Insert card box', 1, 'each', 1.04),
        ],
        product: { baseIngredients: [line('Other', 'ot-box', 'Insert card box', 1, 'each', 1.04)] },
      },
    ],
  })

  const usage = collectIngredientUsage(index)
  const keys = usage.map((r) => r.key)
  assert.ok(keys.includes('Gilmours:gl-gherkin'), 'recipe ingredients are listed')
  assert.ok(keys.includes('Other:ot-box'), 'used Other products are listed')
  assert.ok(keys.includes('Other:ot-napkin'), 'every Other product is listed, used or not')
  assert.ok(!keys.includes('Gilmours:gl-unused'), 'the unused Gilmours aisle is not listed')
  assert.ok(usage[0].recipeCount >= usage[usage.length - 1].recipeCount, 'most-used first')

  const before = costVariant('v1', index)
  assert.ok(before.total != null, 'house cost should resolve')
  const houseCost = before.total

  // Operator pays $48 for the same 2 × 2kg carton → $12/kg instead of $5/kg.
  applyPriceSheet(index, [
    {
      source: 'Gilmours',
      sourceId: 'gl-gherkin',
      supplierName: 'Local Gilmours',
      packPrice: 48,
      unitsPerPack: 2,
      sizePerUnit: 2,
      sizeUnit: 'kg',
    },
  ])

  const after = costVariant('v1', index)
  assert.ok(after.total != null && after.total > houseCost, 'operator pack price lifts the variant cost')
  const gherkinLine = after.lines.find((l) => l.id === 'c-gherkins')
  assert.ok(gherkinLine, 'component line is still present after overlay')

  // Stored totals on the index are the values we loaded, not the overlay.
  const variant = index.variantsByVariantId.get('v1')
  assert.equal(variant?.storedTotalCost, 0, 'overlay must not rewrite stored variant totals')

  const merged = mergeDraftEntries(
    [
      {
        source: 'Gilmours',
        sourceId: 'gl-gherkin',
        packPrice: 48,
        unitsPerPack: 2,
        sizePerUnit: 2,
        sizeUnit: 'kg',
      },
    ],
    [
      {
        source: 'Gilmours',
        sourceId: 'gl-gherkin',
        packPrice: null,
        unitsPerPack: 2,
        sizePerUnit: 2,
        sizeUnit: 'kg',
      },
    ]
  )
  assert.equal(merged.length, 0, 'a null draft pack price drops the saved row')

  console.log('pricesheet tests passed')
}

run()
