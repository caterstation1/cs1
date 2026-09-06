import assert from 'node:assert/strict'
import { RecalcStore, recalcAll } from '../recalc'
import { BidfoodRow, ComponentRow, VariantRow, createCostIndex } from '../resolve'

function approx(actual: number | null | undefined, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(actual != null, `${message}: expected ~${expected}, got ${actual}`)
  assert.ok(
    Math.abs((actual as number) - expected) < tolerance,
    `${message}: expected ~${expected}, got ${actual}`
  )
}

interface MemoryState {
  bidfood: BidfoodRow[]
  components: ComponentRow[]
  variants: VariantRow[]
  componentWrites: number
  variantWrites: number
}

// Stands in for Postgres so recalc can be exercised without a database. The
// writes land back on the same rows the next buildIndex reads, which is what
// makes the idempotency assertion meaningful.
function createMemoryStore(): { store: RecalcStore; state: MemoryState } {
  const state: MemoryState = {
    bidfood: [
      {
        id: 'bf-cheese',
        productCode: 'B100',
        description: 'Colby Cheese',
        packSize: '2x5kg',
        ctnQty: '2',
        uom: 'CTN',
        // $100 / 10kg = $10.00/kg
        lastPricePaid: 100,
      },
    ],
    components: [
      {
        id: 'c-sauce',
        name: 'Cheese sauce',
        producedQuantity: 2,
        producedUnit: 'kg',
        totalCost: 0,
        costPerOutputUnit: 0,
        normalizedOutputUnit: 'unit',
        ingredients: [
          { source: 'Bidfood', id: 'bf-cheese', name: 'Colby Cheese', quantity: 1, unit: 'kg', cost: 8 },
        ],
      },
      {
        id: 'c-platter',
        name: 'Cheese platter',
        producedQuantity: 1,
        producedUnit: 'unit',
        totalCost: 0,
        costPerOutputUnit: 0,
        normalizedOutputUnit: 'unit',
        ingredients: [
          { source: 'Components', id: 'c-sauce', name: 'Cheese sauce', quantity: 500, unit: 'g', cost: 1 },
        ],
      },
    ],
    variants: [
      {
        id: 'pv-1',
        variantId: 'shopify-1',
        productId: 'prod-1',
        shopifyName: 'Cheese Platter',
        shopifyPrice: 46,
        totalCost: 0,
        ingredients: [
          { source: 'Components', id: 'c-platter', name: 'Cheese platter', quantity: 2, unit: 'unit', cost: 1 },
        ],
      },
    ],
    componentWrites: 0,
    variantWrites: 0,
  }

  const store: RecalcStore = {
    async buildIndex() {
      return createCostIndex({
        bidfood: state.bidfood,
        components: state.components,
        variants: state.variants,
      })
    },
    async updateComponent(id, data) {
      const row = state.components.find((c) => c.id === id)
      assert.ok(row, `unknown component ${id}`)
      Object.assign(row as ComponentRow, data)
      state.componentWrites += 1
    },
    async updateVariant(id, data) {
      const row = state.variants.find((v) => v.id === id)
      assert.ok(row, `unknown variant ${id}`)
      row!.totalCost = data.totalCost
      state.variantWrites += 1
    },
    async persistRun() {
      return null
    },
  }

  return { store, state }
}

async function run() {
  // --- first run prices everything from the supplier catalogue ---
  const { store, state } = createMemoryStore()
  const first = await recalcAll('test', { store })

  assert.equal(first.components.updated, 2, 'both components should be repriced on the first run')
  assert.equal(first.variants.updated, 1)
  assert.equal(first.coveragePct, 1, 'every line resolved')
  assert.equal(first.unresolved.length, 0)
  assert.equal(first.dryRun, false)

  // 1kg cheese at $10/kg over a 2kg batch -> $5.00/kg
  approx(state.components[0].totalCost, 10, 'sauce batch cost')
  approx(state.components[0].costPerOutputUnit, 5, 'sauce cost per kg')
  assert.equal(state.components[0].normalizedOutputUnit, 'kg', 'normalizedOutputUnit is dual-written')
  // 500g of sauce at $5/kg -> $2.50
  approx(state.components[1].totalCost, 2.5, 'platter cost uses the sauce cost computed in the same run')
  // 2 platters -> $5.00
  approx(state.variants[0].totalCost, 5, 'variant cost rolls the whole tree up')

  // --- second run is a no-op ---
  const second = await recalcAll('test', { store })
  assert.equal(second.components.updated, 0, 'a second run must produce no diffs')
  assert.equal(second.variants.updated, 0)
  assert.equal(state.componentWrites, 2, 'no redundant writes on the second run')
  assert.equal(state.variantWrites, 1)

  // --- a Bidfood price change propagates component -> parent -> variant ---
  state.bidfood[0].lastPricePaid = 150 // $15.00/kg
  const third = await recalcAll('bidfood-upload', { store })
  assert.equal(third.components.updated, 2, 'both the child and its parent reprice')
  assert.equal(third.variants.updated, 1)

  approx(state.components[0].totalCost, 15, 'sauce batch cost follows the supplier price')
  approx(state.components[0].costPerOutputUnit, 7.5, 'sauce cost per kg follows the supplier price')
  approx(state.components[1].totalCost, 3.75, 'parent component follows the child')
  approx(state.variants[0].totalCost, 7.5, 'variant follows the parent')

  const sauceChange = third.componentChanges.find((c) => c.id === 'c-sauce')
  approx(sauceChange?.totalCostBefore, 10, 'change record carries the previous value')
  approx(sauceChange?.totalCostAfter, 15, 'change record carries the new value')

  // --- dry run writes nothing ---
  const dryState = createMemoryStore()
  const dry = await recalcAll('test', { store: dryState.store, dryRun: true })
  assert.equal(dry.components.updated, 2, 'a dry run still reports what would change')
  assert.equal(dryState.state.componentWrites, 0, 'a dry run must not write')
  assert.equal(dryState.state.variantWrites, 0)
  assert.equal(dryState.state.components[0].totalCost, 0)

  // --- an unresolvable ingredient leaves the stored value alone ---
  const brokenState = createMemoryStore()
  brokenState.state.components[0].ingredients = [
    { source: 'Bidfood', id: 'bf-deleted', name: 'Deleted item', quantity: 1, unit: 'kg', cost: 8 },
  ]
  brokenState.state.components[0].totalCost = 99
  brokenState.state.components[0].costPerOutputUnit = 49.5
  const brokenRun = await recalcAll('test', { store: brokenState.store })

  approx(brokenState.state.components[0].totalCost, 99, 'an unknown cost must not overwrite the last known one')
  assert.ok(brokenRun.coveragePct < 1, 'coverage reports the gap')
  const gap = brokenRun.unresolved.find((u) => u.id === 'c-sauce')
  assert.deepEqual(gap?.reasons, ['missing-ref'])

  // The gap propagates: the parent and the variant that depend on the broken
  // child are unknown too, rather than quietly costing less than before.
  assert.equal(brokenRun.components.unresolved, 2)
  const parentGap = brokenRun.unresolved.find((u) => u.id === 'c-platter')
  assert.deepEqual(parentGap?.reasons, ['child-cost-unknown', 'missing-ref'])
  assert.equal(brokenState.state.components[1].totalCost, 0, 'the parent is left alone as well')
  assert.equal(brokenRun.variants.unresolved, 1)
  assert.equal(brokenState.state.variants[0].totalCost, 0)

  // --- cycles are reported, and the run still completes ---
  const cyclicState = createMemoryStore()
  cyclicState.state.components[0].ingredients = [
    { source: 'Components', id: 'c-platter', name: 'Cheese platter', quantity: 1, unit: 'unit', cost: 1 },
  ]
  const cyclicRun = await recalcAll('test', { store: cyclicState.store })
  assert.equal(cyclicRun.cyclicComponentIds.length, 2, 'both members of the cycle are flagged')
  assert.equal(cyclicRun.components.updated, 0)
  assert.ok(cyclicRun.warnings.some((w) => w.includes('cycle')))

  console.log('pricing recalc tests passed')
}

run().catch((error) => {
  console.error('pricing recalc tests failed', error)
  process.exitCode = 1
})
