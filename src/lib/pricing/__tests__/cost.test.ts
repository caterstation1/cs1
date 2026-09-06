import assert from 'node:assert/strict'
import { costComponent, costVariant, marginFor, topoSortComponents } from '../cost'
import { CostIndexInput, createCostIndex } from '../resolve'

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

// $100 for 2 x 5kg = 10kg -> $10.00/kg
const BIDFOOD_CHEESE = {
  id: 'bf-cheese',
  productCode: 'B100',
  description: 'Colby Cheese',
  packSize: '2x5kg',
  ctnQty: '2',
  uom: 'CTN',
  lastPricePaid: 100,
}

// $60 for a 20l drum, priced per drum -> $3.00/l
const GILMOURS_OIL = {
  id: 'gl-oil',
  sku: 'G1',
  description: 'Canola Oil',
  packSize: '20l',
  uom: 'EACH',
  price: 60,
}

const PRODUCE_LETTUCE = { id: 'pc-lettuce', productCode: 'P1', productName: 'Lettuce', price: 2.5 }
const OTHER_BOX = { id: 'ot-box', name: 'Insert card box', supplier: 'Packaging Co', cost: 1.04 }
const OTHER_FREEBIE = { id: 'ot-zero', name: 'Unpriced sticker', supplier: 'Packaging Co', cost: 0 }

function baseIndex(overrides: Partial<CostIndexInput> = {}) {
  return createCostIndex({
    bidfood: [BIDFOOD_CHEESE],
    gilmours: [GILMOURS_OIL],
    produceCo: [PRODUCE_LETTUCE],
    other: [OTHER_BOX, OTHER_FREEBIE],
    ...overrides,
  })
}

function threeDeepComponents() {
  return [
    {
      // 0.5kg cheese @ $10/kg + 0.5l oil @ $3/l = $6.50 for a 2kg batch -> $3.25/kg
      id: 'c-sauce',
      name: 'Cheese sauce',
      producedQuantity: 2,
      producedUnit: 'kg',
      totalCost: 0,
      ingredients: [
        line('Bidfood', 'bf-cheese', 'Colby Cheese', 500, 'g', 8),
        line('Gilmours', 'gl-oil', 'Canola Oil', 500, 'ml', 3),
      ],
    },
    {
      // 250g of sauce ($0.8125) + 2 lettuce ($5.00) = $5.8125 per unit
      id: 'c-salad',
      name: 'Loaded salad',
      producedQuantity: 1,
      producedUnit: 'unit',
      totalCost: 0,
      ingredients: [
        line('Components', 'c-sauce', 'Cheese sauce', 250, 'g', 3.25),
        line('ProduceCo', 'pc-lettuce', 'Lettuce', 2, 'each', 2.5),
      ],
    },
    {
      // 1 salad ($5.8125) + 3 boxes ($3.12) = $8.9325
      id: 'c-platter',
      name: 'Salad platter',
      producedQuantity: 1,
      producedUnit: 'unit',
      totalCost: 0,
      ingredients: [
        line('Components', 'c-salad', 'Loaded salad', 1, 'unit', 5.8125),
        line('Other', 'ot-box', 'Insert card box', 3, 'unit', 1.04),
      ],
    },
  ]
}

function run() {
  // --- three-deep rollup ---
  const index = baseIndex({ components: threeDeepComponents() })

  const sauce = costComponent('c-sauce', index)
  assert.equal(sauce.ok, true, `sauce should cost cleanly: ${JSON.stringify(sauce.missing)}`)
  approx(sauce.total, 6.5, 'cheese sauce batch cost')
  approx(sauce.perUnit, 3.25, 'cheese sauce per kg')
  assert.equal(sauce.unit, 'kg', 'output unit is written in legacy spelling')
  assert.equal(sauce.canonicalUnit, 'kg')

  const salad = costComponent('c-salad', index)
  assert.equal(salad.ok, true, `salad should cost cleanly: ${JSON.stringify(salad.missing)}`)
  approx(salad.total, 5.8125, 'salad cost rolls the nested sauce up')
  assert.equal(salad.unit, 'unit', "an 'each' output is dual-written as 'unit'")

  const platter = costComponent('c-platter', index)
  assert.equal(platter.ok, true, `platter should cost cleanly: ${JSON.stringify(platter.missing)}`)
  approx(platter.total, 8.9325, 'three-deep rollup')
  assert.equal(platter.coverage.pct, 1)

  // ProduceCo is costed rather than silently priced at zero.
  const lettuceLine = salad.lines.find((l) => l.source === 'ProduceCo')
  approx(lettuceLine?.lineCost, 5, 'ProduceCo line is costed')
  assert.equal(lettuceLine?.supplier, 'ProduceCo')

  // A Produce Co row that knows its pack is costed against it, not per item. A
  // $134 case of 12kg chicken is $11.17/kg; read as 'each' it is $134 a portion.
  const packed = createCostIndex({
    produceCo: [
      { id: 'pc-chicken', productCode: '2HCHBSL', productName: 'Chicken Breasts Skinless', packSize: '12kg', uom: 'Case', price: 134 },
      { id: 'pc-beet', productCode: 'BEE', productName: 'Beetroot Red', uom: 'Kilo', price: 5.2 },
      { id: 'pc-bare', productCode: 'POA', productName: 'Punnet of something', price: 3.5 },
    ],
  })
  const chicken = packed.catalogue.get('ProduceCo:pc-chicken')!
  approx(chicken.cost?.unitCost, 134 / 12, 'case price divides by the pack weight')
  assert.equal(chicken.cost?.unit, 'kg')
  const beet = packed.catalogue.get('ProduceCo:pc-beet')!
  approx(beet.cost?.unitCost, 5.2, 'a per-kilo price is already per canonical unit')
  assert.equal(beet.cost?.unit, 'kg')
  // No pack and no uom still falls back to a price per item, as before.
  const unpacked = packed.catalogue.get('ProduceCo:pc-bare')!
  approx(unpacked.cost?.unitCost, 3.5, 'no pack means the price stands as a price per item')
  assert.equal(unpacked.cost?.unit, 'each')

  // The nested component uses the child's freshly computed per-unit cost, not
  // the snapshot frozen in the JSON row.
  const staleIndex = baseIndex({
    components: threeDeepComponents().map((c) =>
      c.id === 'c-salad'
        ? {
            ...c,
            ingredients: [
              line('Components', 'c-sauce', 'Cheese sauce', 250, 'g', 0.01),
              line('ProduceCo', 'pc-lettuce', 'Lettuce', 2, 'each', 2.5),
            ],
          }
        : c
    ),
  })
  approx(costComponent('c-salad', staleIndex).total, 5.8125, 'stale snapshot cost is ignored')

  // --- dependency order ---
  const { order, cyclic } = topoSortComponents(index)
  assert.equal(cyclic.length, 0)
  assert.ok(
    order.indexOf('c-sauce') < order.indexOf('c-salad') && order.indexOf('c-salad') < order.indexOf('c-platter'),
    `children must be costed before parents, got ${order.join(' -> ')}`
  )

  // --- cycles terminate and report, rather than hanging ---
  const cyclicIndex = baseIndex({
    components: [
      {
        id: 'c-a',
        name: 'A',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Components', 'c-b', 'B', 1, 'unit', 1)],
      },
      {
        id: 'c-b',
        name: 'B',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Components', 'c-a', 'A', 1, 'unit', 1)],
      },
    ],
  })
  const cycled = costComponent('c-a', cyclicIndex)
  assert.equal(cycled.total, null, 'a cycle has no knowable cost')
  assert.ok(cycled.missing.some((m) => m.reason === 'cycle'), 'a cycle must be reported as such')
  const cyclicSort = topoSortComponents(cyclicIndex)
  assert.deepEqual(cyclicSort.cyclic.sort(), ['c-a', 'c-b'], 'both members of the cycle are flagged')
  assert.equal(cyclicSort.order.length, 2, 'cyclic components are still visited')

  // Self-reference is the degenerate case.
  const selfIndex = baseIndex({
    components: [
      {
        id: 'c-self',
        name: 'Self',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Components', 'c-self', 'Self', 1, 'unit', 1)],
      },
    ],
  })
  assert.equal(costComponent('c-self', selfIndex).total, null)

  // --- weights are reference data and must never move the cost ---
  //
  // producedQuantity is the final usable output, so cooking loss is already
  // taken out of it. Dividing by cooked/(raw - trim) as well would charge for
  // the same loss twice; this pins the two recipes to the same number so the
  // yield divisor cannot come back by accident.
  const withoutWeights = {
    id: 'c-roast',
    name: 'Roast beef',
    producedQuantity: 10,
    producedUnit: 'kg',
    totalCost: 0,
    ingredients: [line('Bidfood', 'bf-cheese', 'Colby Cheese', 10, 'kg', 10)],
  }
  const withWeights = { ...withoutWeights, rawWeight: 12, cookedWeight: 9, trimWasteWeight: 2, weightUnit: 'kg' }

  const bare = costComponent('c-roast', baseIndex({ components: [withoutWeights] }))
  const weighed = costComponent('c-roast', baseIndex({ components: [withWeights] }))

  approx(bare.total, 100, 'batch cost')
  approx(bare.perUnit, 10, 'cost per output unit is the plain division by producedQuantity')
  approx(weighed.total, 100, 'recorded weights do not change the batch cost')
  approx(
    weighed.perUnit,
    10,
    'recorded weights do not change cost per unit — the loss is already in producedQuantity'
  )
  assert.equal(bare.outputQuantity, 10, 'output quantity is producedQuantity as entered')
  assert.equal(weighed.outputQuantity, 10, 'output quantity ignores raw/cooked/trim weights')

  // --- missing costs are null, never zero ---
  const brokenIndex = baseIndex({
    components: [
      {
        id: 'c-broken',
        name: 'Broken recipe',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 42,
        ingredients: [
          line('Other', 'ot-box', 'Insert card box', 2, 'unit', 1.04),
          line('Bidfood', 'bf-deleted', 'Deleted item', 1, 'kg', 7),
        ],
      },
    ],
  })
  const broken = costComponent('c-broken', brokenIndex)
  assert.equal(broken.total, null, 'an unresolvable line makes the total unknown, not smaller')
  assert.equal(broken.perUnit, null)
  approx(broken.partialTotal, 2.08, 'the resolved lines are still summed for triage')
  assert.equal(broken.coverage.resolvedLines, 1)
  assert.equal(broken.coverage.totalLines, 2)
  assert.equal(broken.missing[0].reason, 'missing-ref')
  approx(broken.snapshotTotal, 2.08 + 7, 'snapshot total reproduces the legacy formula')

  // A catalogue price of zero is unknown, not free.
  const zeroIndex = baseIndex({
    components: [
      {
        id: 'c-zero',
        name: 'Zero priced',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Other', 'ot-zero', 'Unpriced sticker', 1, 'unit', 0)],
      },
    ],
  })
  const zero = costComponent('c-zero', zeroIndex)
  assert.equal(zero.total, null)
  assert.equal(zero.missing[0].reason, 'unresolvable-price')
  assert.ok(zero.missing[0].detail?.includes('zero-price'))

  // ...unless the caller says zero really is free.
  const freeIndex = createCostIndex({
    other: [OTHER_FREEBIE],
    options: { treatZeroPriceAsFree: true },
    components: [
      {
        id: 'c-zero',
        name: 'Zero priced',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Other', 'ot-zero', 'Unpriced sticker', 1, 'unit', 0)],
      },
    ],
  })
  approx(costComponent('c-zero', freeIndex).total, 0, 'genuinely free is still allowed to be zero')

  // --- unit handling ---
  const mismatchIndex = baseIndex({
    components: [
      {
        id: 'c-mismatch',
        name: 'Unit mismatch',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [line('Bidfood', 'bf-cheese', 'Colby Cheese', 2, 'each', 10)],
      },
    ],
  })
  const mismatch = costComponent('c-mismatch', mismatchIndex)
  assert.equal(mismatch.total, null, 'counting a kilo-priced item by the each is not costable')
  assert.equal(mismatch.missing[0].reason, 'unit-kind-mismatch')

  const unknownUnitIndex = baseIndex({
    components: [
      {
        id: 'c-unknown-unit',
        name: 'Unknown unit',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [
          line('Bidfood', 'bf-cheese', 'Colby Cheese', 2, 'splodge', 10),
          line('Other', 'ot-box', 'Insert card box', 2, 'splodge', 1.04),
        ],
      },
    ],
  })
  const unknownUnit = costComponent('c-unknown-unit', unknownUnitIndex)
  assert.equal(unknownUnit.lines[0].reason, 'unknown-unit', 'unknown unit against a kilo price is a gap')
  assert.equal(unknownUnit.lines[0].unitAssumption, null, 'a failed line made no assumption')
  // An each-priced item counted in an unrecognised unit is still a count.
  approx(unknownUnit.lines[1].lineCost, 2.08, 'unknown unit against an each price counts pieces')
  assert.equal(unknownUnit.lines[1].unitAssumption, 'unrecognised-counted')

  // Rows written before units existed multiply straight through, as they do
  // today. That is a guess, so it is labelled rather than left invisible.
  const noUnitIndex = baseIndex({
    components: [
      {
        id: 'c-nounit',
        name: 'No unit',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        ingredients: [
          { source: 'Other', id: 'ot-box', name: 'Insert card box', quantity: 2, cost: 1.04 },
          { source: 'Bidfood', id: 'bf-cheese', name: 'Colby Cheese', quantity: 3, cost: 10 },
        ],
      },
    ],
  })
  const noUnit = costComponent('c-nounit', noUnitIndex)
  approx(noUnit.total, 2.08 + 30, 'a row with no unit is taken at face value')
  assert.equal(noUnit.lines[0].unitAssumption, 'missing-assumed')
  // Including against a per-kilo price, where the assumption is load-bearing.
  assert.equal(noUnit.lines[1].unitAssumption, 'missing-assumed')
  assert.equal(noUnit.lines[1].unitCostUnit, 'kg')

  // A declared, convertible unit is not an assumption.
  assert.equal(sauce.lines[0].unitAssumption, 'declared', '500 g against a per-kg price is evidenced')

  // --- variants ---
  const variantIndex = baseIndex({
    components: threeDeepComponents(),
    variants: [
      {
        id: 'pv-1',
        variantId: 'shopify-1',
        productId: 'prod-1',
        shopifyName: 'Salad Platter - 10 people',
        shopifyPrice: 46,
        totalCost: 0,
        ingredients: [line('Components', 'c-platter', 'Salad platter', 1, 'unit', 8.93)],
        product: { baseIngredients: [line('Other', 'ot-box', 'Insert card box', 2, 'unit', 1.04)] },
      },
    ],
  })
  const variant = costVariant('shopify-1', variantIndex)
  assert.equal(variant.ok, true, `variant should cost cleanly: ${JSON.stringify(variant.missing)}`)
  approx(variant.total, 8.9325 + 2.08, 'variant combines base then variant lines')
  assert.equal(variant.lines[0].origin, 'base', 'base ingredients come first, as every existing consumer expects')
  assert.equal(variant.lines[1].origin, 'variant')

  assert.equal(costVariant('does-not-exist', variantIndex).total, null)

  // --- margins ---
  const margin = marginFor(10, 46, 0.15, 0.7)
  approx(margin.rrpEx, 40, 'GST stripped')
  approx(margin.margin, 0.75, 'margin on cost of 10 against $40 ex')
  approx(margin.targetRrpEx, 100 / 3, '70% target RRP ex GST')
  approx(margin.targetRrpInclGst, (100 / 3) * 1.15, '70% target RRP incl GST')
  assert.equal(marginFor(null, 46).margin, null, 'unknown cost means unknown margin')

  console.log('pricing cost tests passed')
}

run()
