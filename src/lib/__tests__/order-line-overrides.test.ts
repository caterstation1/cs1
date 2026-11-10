import assert from 'node:assert/strict'
import { applyOverridesToProduct } from '../order-line-overrides'

const base = {
  shopifyName: 'Panko Katsu Chicken (DF) / Beef Brisket (GF) (DF) (H) / No Serveware',
  meat1: 'Chicken',
  meat2: 'Beef',
  meats: ['Chicken', 'Beef', null],
  timer1: 10,
  timer2: 20,
  timers: [10, 20, null],
  option1: null,
  option2: null,
  options: [null, null, 'No Serveware'],
}

// An order-only meat override rewrites the pair and leaves the third title
// part alone.
{
  const merged = applyOverridesToProduct(base, { meat1: 'Pork' })!
  assert.deepEqual(merged.meats, ['Pork', 'Beef', null])
  assert.equal(merged.meat1, 'Pork')
  assert.deepEqual(merged.timers, [10, 20, null], 'an untouched array is passed through as-is')
  assert.deepEqual(merged.options, [null, null, 'No Serveware'])
}

// Overriding an option must not drop the third part's option.
{
  const merged = applyOverridesToProduct(base, { option1: 'Extra Sauce' })!
  assert.deepEqual(merged.options, ['Extra Sauce', null, 'No Serveware'])
}

// Clearing one of the pair empties only that slot.
{
  const merged = applyOverridesToProduct(base, { meat2: '' })!
  assert.deepEqual(merged.meats, ['Chicken', '', null])
}

// Order card placement rides along as an override, including clearing a
// catalog-level choice back to the SKU-derived default.
{
  const merged = applyOverridesToProduct({ ...base, lineKind: null }, { lineKind: 'addon' })!
  assert.equal(merged.lineKind, 'addon')
  const cleared = applyOverridesToProduct({ ...base, lineKind: 'addon' }, { lineKind: null })!
  assert.equal(cleared.lineKind, null)
}

// No overrides is a plain copy.
{
  const merged = applyOverridesToProduct(base, undefined)!
  assert.deepEqual(merged.meats, ['Chicken', 'Beef', null])
  assert.notEqual(merged, base, 'the base is never mutated')
}

console.log('✅ order-line-overrides merge tests passed')
