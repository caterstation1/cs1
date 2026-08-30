// The variant save path must never write a total that leaves out the
// product's base recipe.
//
// The variant editor only ever showed a variant's *own* rows, summed them in
// the browser, and posted that as `totalCost`. For the 680 variants whose
// product carries a base recipe that silently dropped the base — a Build a
// Bagel Station variant stored $15.07 against a real cost near $77, because
// $15.07 is the two rows the editor happened to show.

import assert from 'node:assert/strict'
import { deriveVariantCost } from '../persist'
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

const STATION = { id: 'ot-station', name: 'Large station', supplier: 'Packaging Co', cost: 7.36 }
const BOX = { id: 'ot-box', name: 'Insert card box', supplier: 'Packaging Co', cost: 1.04 }
const SERVEWARE = { id: 'ot-serveware', name: 'Serveware - 25', supplier: 'Packaging Co', cost: 4.24 }
const GF_BAGELS = { id: 'ot-gf', name: 'Bagels GF 3pk', supplier: 'Bidfood', cost: 10.82 }

// $7.36 + 2 x $1.04
const BASE = [
  line('Other', 'ot-station', 'Large station', 1, 'unit', 7.36),
  line('Other', 'ot-box', 'Insert card box', 2, 'unit', 1.04),
]
const BASE_TOTAL = 7.36 + 2 * 1.04

function index(overrides: Partial<CostIndexInput> = {}) {
  return createCostIndex({
    other: [STATION, BOX, SERVEWARE, GF_BAGELS],
    ...overrides,
  })
}

function variant(id: string, ingredients: unknown[], baseIngredients: unknown[] | null = BASE) {
  return {
    id: `pv-${id}`,
    variantId: id,
    productId: 'prod-1',
    shopifyName: 'Build a Bagel Station',
    shopifyPrice: 494,
    totalCost: 0,
    ingredients,
    product: { baseIngredients },
  }
}

// --- base is always part of the derived total ------------------------------

{
  const own = [line('Other', 'ot-serveware', 'Serveware - 25', 1, 'unit', 4.24)]
  const outcome = deriveVariantCost('v-serveware', index({ variants: [variant('v-serveware', own)] }))

  assert.equal(outcome.serverDerived, true)
  approx(outcome.totalCost, BASE_TOTAL + 4.24, 'derived total is base plus the variant rows')
  assert.ok(
    (outcome.totalCost as number) > 4.24,
    'the total must exceed the variant own rows the editor would have summed'
  )
  assert.equal(outcome.coverage.totalLines, 3, 'both base rows and the variant row are costed')
  assert.deepEqual(outcome.reasons, [])
}

{
  // The exact shape of the reported bug: a variant with no rows of its own
  // used to save $0.00 and report an impossible margin.
  const outcome = deriveVariantCost('v-empty', index({ variants: [variant('v-empty', [])] }))

  approx(outcome.totalCost, BASE_TOTAL, 'a variant with no rows of its own still costs the base recipe')
  assert.notEqual(outcome.totalCost, 0, 'an empty variant recipe is not a free variant')
}

{
  // More expensive variant, more expensive total. The stale stored values had
  // this backwards: the two-option variant sat below the one-option variant.
  const cheaper = deriveVariantCost(
    'v-one',
    index({ variants: [variant('v-one', [line('Other', 'ot-serveware', 'Serveware - 25', 1, 'unit', 4.24)])] })
  )
  const dearer = deriveVariantCost(
    'v-two',
    index({
      variants: [
        variant('v-two', [
          line('Other', 'ot-serveware', 'Serveware - 25', 1, 'unit', 4.24),
          line('Other', 'ot-gf', 'Bagels GF 3pk', 1, 'unit', 10.82),
        ]),
      ],
    })
  )

  assert.ok(
    (dearer.totalCost as number) > (cheaper.totalCost as number),
    'adding an option can only increase a variant cost'
  )
  approx(dearer.totalCost, BASE_TOTAL + 4.24 + 10.82, 'both options land on top of the base')
}

// --- unresolvable costs are reported, never guessed ------------------------

{
  const outcome = deriveVariantCost(
    'v-broken',
    index({ variants: [variant('v-broken', [line('Other', 'nope', 'Missing item', 1, 'unit', 99)])] })
  )

  assert.equal(outcome.totalCost, null, 'an unresolvable line yields no total, so the caller leaves the column alone')
  assert.equal(outcome.serverDerived, false)
  assert.deepEqual(outcome.reasons, ['missing-ref'])
  assert.equal(outcome.coverage.resolvedLines, 2, 'the base rows still resolved')
  assert.equal(outcome.coverage.totalLines, 3)
}

{
  const outcome = deriveVariantCost('v-unknown', index({ variants: [] }))
  assert.equal(outcome.totalCost, null, 'a variant that is not in the index has no derivable cost')
  assert.deepEqual(outcome.reasons, ['missing-ref'])
}

// --- a product with no base recipe is unaffected ---------------------------

{
  const own = [line('Other', 'ot-serveware', 'Serveware - 25', 1, 'unit', 4.24)]
  const outcome = deriveVariantCost('v-nobase', index({ variants: [variant('v-nobase', own, null)] }))
  approx(outcome.totalCost, 4.24, 'without a base recipe the total is just the variant rows')
}

console.log('variant save cost tests passed')
