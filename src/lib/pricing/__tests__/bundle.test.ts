import assert from 'node:assert/strict'
import { costVariant } from '../cost'
import { CostIndexInput, createCostIndex, parseBundleLines } from '../resolve'

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

// $10.00 each, so every expected total below is a whole number of servewares.
const OTHER_SERVEWARE = { id: 'ot-serveware', name: 'Serveware set', supplier: 'Packaging Co', cost: 10 }

/**
 * Two costable child stations and a pack that contains them. The children are
 * priced from an Other catalogue row rather than a stored totalCost, so the
 * assertions prove the pack is costed from live child recipes.
 */
function children() {
  return [
    {
      id: 'v-taco-row',
      variantId: '111',
      productId: 'p-taco',
      shopifyName: 'Taco Station / No Serveware',
      totalCost: 0,
      // 4 x $10 = $40
      ingredients: [line('Other', 'ot-serveware', 'Serveware set', 4, 'unit', 10)],
    },
    {
      id: 'v-slider-row',
      variantId: '222',
      productId: 'p-slider',
      shopifyName: 'Slider Station / No Serveware',
      totalCost: 0,
      // 7 x $10 = $70
      ingredients: [line('Other', 'ot-serveware', 'Serveware set', 7, 'unit', 10)],
    },
  ]
}

function index(overrides: Partial<CostIndexInput> = {}) {
  return createCostIndex({ other: [OTHER_SERVEWARE], ...overrides })
}

function run() {
  // --- parsing ---
  {
    const lines = parseBundleLines([
      { variantId: '111', quantity: 1 },
      { variantId: '222', quantity: 2 },
      { variantId: '111', quantity: 1 },
      { variantId: '', quantity: 5 },
      { quantity: 3 },
      'nonsense',
    ])
    assert.equal(lines.length, 2, 'entries without a variantId are dropped')
    assert.deepEqual(
      lines.map((l) => [l.id, l.quantity]),
      [
        ['111', 2],
        ['222', 2],
      ],
      'a child listed twice is two portions of food, not one'
    )
    assert.ok(
      lines.every((l) => l.source === 'Products' && l.unit === 'each' && l.origin === 'bundle'),
      'pack contents are Products rows counted in each'
    )

    // The Json column has been written as a string by at least one older path.
    assert.equal(parseBundleLines('[{"variantId":"111","quantity":2}]').length, 1)
    assert.deepEqual(parseBundleLines('not json'), [])
    assert.deepEqual(parseBundleLines(null), [])

    const missingQty = parseBundleLines([{ variantId: '111' }, { variantId: '222', quantity: 0 }])
    assert.deepEqual(
      missingQty.map((l) => l.quantity),
      [1, 1],
      'a missing or zero quantity means one of the child, never none of it'
    )
  }

  // --- a pack costs its contents ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          shopifyPrice: 2069,
          totalCost: 0,
          product: {
            bundleDefaultItems: [
              { variantId: '111', quantity: 1 },
              { variantId: '222', quantity: 2 },
            ],
          },
        },
      ],
    })

    const pack = costVariant('999', built)
    assert.equal(pack.ok, true, `pack should cost cleanly: ${JSON.stringify(pack.missing)}`)
    assert.equal(pack.emptyRecipe, false, 'a pack with contents is not an empty recipe')
    approx(pack.total, 40 + 2 * 70, 'pack costs one taco station plus two slider stations')
    assert.equal(pack.lines.length, 2)
    assert.ok(
      pack.lines.every((l) => l.origin === 'bundle' && l.provenance === 'variant'),
      'every pack line resolved through the child variant, not a stored number'
    )
  }

  // --- expansion can be switched off, for the parity report ---
  {
    const input: Partial<CostIndexInput> = {
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          totalCost: 0,
          product: { bundleDefaultItems: [{ variantId: '111', quantity: 1 }] },
        },
      ],
    }
    const off = costVariant('999', index({ ...input, options: { expandBundles: false } }))
    approx(off.total, 0, 'with expansion off a pack has no rows at all')
    assert.equal(off.emptyRecipe, true)
  }

  // --- per-variant contents beat the product default ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          totalCost: 0,
          bundleItems: [{ variantId: '222', quantity: 1 }],
          product: { bundleDefaultItems: [{ variantId: '111', quantity: 3 }] },
        },
      ],
    })

    const pack = costVariant('999', built)
    approx(pack.total, 70, 'the variant override replaces the product default outright')
    assert.equal(pack.lines.length, 1, 'the product default contributes nothing once overridden')
  }

  // --- no double counting when a pack also carries its own rows ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'Yes ($80)',
          totalCost: 0,
          // The first row duplicates a pack child; the second is the serveware
          // surcharge this variant genuinely adds on top of the pack.
          ingredients: [
            line('Products', '111', 'Taco Station / No Serveware', 1, 'each', 40),
            line('Other', 'ot-serveware', 'Serveware set', 2, 'unit', 10),
          ],
          product: { bundleDefaultItems: [{ variantId: '111', quantity: 1 }] },
        },
      ],
    })

    const pack = costVariant('999', built)
    approx(pack.total, 40 + 20, 'the duplicated child is counted once, the surcharge survives')
    assert.deepEqual(
      pack.lines.map((l) => l.origin),
      ['bundle', 'variant'],
      'the legacy duplicate is dropped, not the row that adds real cost'
    )
  }

  // --- an option that already supplies a child wins over the pack row ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          totalCost: 0,
          optionIngredients: [line('Products', '111', 'Taco Station / No Serveware', 1, 'each', 40)],
          product: {
            bundleDefaultItems: [
              { variantId: '111', quantity: 1 },
              { variantId: '222', quantity: 1 },
            ],
          },
        },
      ],
    })

    const pack = costVariant('999', built)
    approx(pack.total, 40 + 70, 'the child the option supplies is not added a second time')
    assert.deepEqual(pack.lines.map((l) => l.origin), ['option', 'bundle'])
  }

  // --- a self-referencing pack terminates and is reported ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          totalCost: 0,
          product: {
            bundleDefaultItems: [
              { variantId: '999', quantity: 1 },
              { variantId: '111', quantity: 1 },
            ],
          },
        },
      ],
    })

    const pack = costVariant('999', built)
    assert.equal(pack.total, null, 'a cycle makes the cost unknown rather than wrong')
    assert.ok(
      pack.missing.some((m) => m.reason === 'cycle'),
      `the cycle should be reported: ${JSON.stringify(pack.missing)}`
    )
    approx(pack.partialTotal, 40, 'the children outside the cycle still resolve, for triage')
  }

  // --- a pack inside a pack terminates too ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-inner-row',
          variantId: '888',
          productId: 'p-inner',
          shopifyName: 'Inner pack',
          totalCost: 0,
          product: { bundleDefaultItems: [{ variantId: '999', quantity: 1 }] },
        },
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'Outer pack',
          totalCost: 0,
          product: { bundleDefaultItems: [{ variantId: '888', quantity: 1 }] },
        },
      ],
    })

    const outer = costVariant('999', built)
    assert.equal(outer.total, null, 'a mutual reference between two packs is unknown, not infinite')
    assert.ok(outer.missing.some((m) => m.reason === 'cycle'))
  }

  // --- nesting works when there is no cycle ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-inner-row',
          variantId: '888',
          productId: 'p-inner',
          shopifyName: 'Small pack',
          totalCost: 0,
          product: { bundleDefaultItems: [{ variantId: '111', quantity: 1 }] },
        },
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'Big pack',
          totalCost: 0,
          product: {
            bundleDefaultItems: [
              { variantId: '888', quantity: 2 },
              { variantId: '222', quantity: 1 },
            ],
          },
        },
      ],
    })

    approx(costVariant('888', built).total, 40, 'small pack costs its one station')
    approx(costVariant('999', built).total, 2 * 40 + 70, 'big pack rolls the small pack up')
  }

  // --- a child that cannot be costed makes the pack unknown, not zero ---
  {
    const built = index({
      variants: [
        ...children(),
        {
          id: 'v-pack-row',
          variantId: '999',
          productId: 'p-pack',
          shopifyName: 'No',
          totalCost: 1234,
          product: {
            bundleDefaultItems: [
              { variantId: '111', quantity: 1 },
              { variantId: 'not-a-variant', quantity: 1 },
            ],
          },
        },
      ],
    })

    const pack = costVariant('999', built)
    assert.equal(pack.total, null, 'a missing child leaves the pack unknown so recalc keeps the old value')
    assert.ok(pack.missing.some((m) => m.reason === 'missing-ref'))
    approx(pack.partialTotal, 40, 'the child that did resolve is still reported')
  }

  console.log('pricing bundle tests passed')
}

run()
