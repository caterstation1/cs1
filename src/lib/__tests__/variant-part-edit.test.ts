import assert from 'node:assert/strict'
import { mirrorScalarsToArrays, type VariantPartFields } from '../variant-part-edit'

function variant(partial: Partial<VariantPartFields> = {}): VariantPartFields {
  return {
    shopifyName: partial.shopifyName ?? 'Panko Katsu Chicken (DF) / Beef Brisket (GF) (DF) (H) / No Serveware',
    meats: partial.meats === undefined ? null : partial.meats,
    timers: partial.timers === undefined ? null : partial.timers,
    options: partial.options === undefined ? null : partial.options,
    meat1: partial.meat1 ?? null,
    meat2: partial.meat2 ?? null,
    timer1: partial.timer1 ?? null,
    timer2: partial.timer2 ?? null,
    option1: partial.option1 ?? null,
    option2: partial.option2 ?? null,
  }
}

// --- the bug this exists to prevent ---------------------------------------

// Editing Meat 1 in the product modal sends scalars only. The order card reads
// the meats array whenever it holds anything, so the array has to move too.
{
  const result = mirrorScalarsToArrays(
    variant({ meats: ['Chicken', 'Beef'], meat1: 'Chicken', meat2: 'Beef' }),
    { meat1: 'Pork' }
  )
  assert.deepEqual(result.meats, ['Pork', 'Beef'])
  assert.equal(result.timers, undefined, 'an untouched array stays out of the update')
  assert.equal(result.options, undefined)
}

// --- extra title parts ----------------------------------------------------

// "A / B / C" titles store a third entry that slots 0/1 edits must not drop.
{
  const result = mirrorScalarsToArrays(
    variant({
      meats: ['Chicken', 'Beef', null],
      options: [null, null, 'No Serveware'],
      timers: [10, 20, null],
    }),
    { meat1: 'Pork', option1: '', timer1: 15 }
  )
  assert.deepEqual(result.meats, ['Pork', 'Beef', null])
  assert.deepEqual(result.options, [null, null, 'No Serveware'])
  assert.deepEqual(result.timers, [15, 20, null])
}

// --- clearing a field -----------------------------------------------------

{
  const result = mirrorScalarsToArrays(
    variant({ meats: ['Chicken', 'Beef'], timers: [10, 20] }),
    { meat2: '', timer2: null }
  )
  assert.deepEqual(result.meats, ['Chicken', null], 'a blank string clears the slot')
  assert.deepEqual(result.timers, [10, null], 'a cleared timer is null, never 0')
}

// --- legacy-only variants -------------------------------------------------

// No arrays stored yet: slots 0/1 seed from the scalars so the untouched
// field survives into the new array.
{
  const result = mirrorScalarsToArrays(
    variant({ meat1: 'Chicken', meat2: 'Beef' }),
    { meat1: 'Pork' }
  )
  assert.deepEqual(result.meats, ['Pork', 'Beef'])
}

// --- values that look empty but are not ------------------------------------

{
  const result = mirrorScalarsToArrays(variant({ timers: [10, 20] }), { timer1: 0 })
  assert.deepEqual(result.timers, [0, 20], 'an explicit 0 is a real value')
}

console.log('✅ variant-part-edit mirror tests passed')
