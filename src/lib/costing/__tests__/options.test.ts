import assert from 'node:assert/strict'
import {
  type CostingOptionRecord,
  type OptionIndex,
  type RecipeRow,
  aliasKey,
  emptyOptionIndex,
  normalizeOptionKey,
  optionRowsForVariant,
  residualLegacyRows,
  rowKey,
} from '../options'

function item(name: string, quantity = 1, cost = 10): RecipeRow {
  return { source: 'Components', id: name.toLowerCase(), name, quantity, cost, unit: 'unit' }
}

function option(
  id: string,
  name: string,
  items: RecipeRow[],
  extra: Partial<CostingOptionRecord> = {}
): CostingOptionRecord {
  return { id, name, kind: 'choice', items, noIngredients: false, ...extra }
}

function indexOf(options: CostingOptionRecord[], aliases: Record<string, string> = {}): OptionIndex {
  const index = emptyOptionIndex()
  for (const o of options) {
    index.byId.set(o.id, o)
    index.byAlias.set(aliasKey(o.name), o)
  }
  for (const [alias, id] of Object.entries(aliases)) {
    const target = options.find((o) => o.id === id)
    if (target) index.byAlias.set(aliasKey(alias), target)
  }
  return index
}

const beef = option('beef', 'Beef Brisket', [item('Beef - portion', 1, 41.78)])
const chicken = option('chicken', 'Chicken (DF)', [item('Normal Chilli Chicken', 1, 47.14)])
const noServeware = option('none', 'No Serveware', [], { noIngredients: true })

// --- title resolution -----------------------------------------------------

{
  const index = indexOf([beef, chicken, noServeware])
  const result = optionRowsForVariant('No Serveware / Chicken (DF) / Beef Brisket', 'p1', index)

  assert.equal(result.rows.length, 2, 'two costed choices contribute two rows')
  assert.equal(result.matched.length, 3)
  assert.deepEqual(result.unmatched, [])
  assert.deepEqual(
    result.rows.map((r) => [r.name, r.quantity]).sort(),
    [
      ['Beef - portion', 1],
      ['Normal Chilli Chicken', 1],
    ].sort()
  )
  assert.equal(result.freeOfCharge.length, 1, 'a deliberately free choice is not a gap')
}

{
  const index = indexOf([beef])
  const result = optionRowsForVariant('Beef Brisket / Mystery Choice', 'p1', index)
  assert.deepEqual(result.unmatched, ['Mystery Choice'], 'unknown segments are reported, not ignored')
}

// A two-meat platter naming the same protein twice really does use two
// portions, so quantities accumulate rather than deduplicate.
{
  const index = indexOf([beef], { 'Beef Brisket (GF DF Halal)': 'beef' })
  const result = optionRowsForVariant('Beef Brisket / Beef Brisket (GF DF Halal)', 'p1', index)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].quantity, 2, 'the same choice twice is two portions')
}

// Aliases are how nine spellings of one thing stay one costed choice.
{
  const index = indexOf([beef], { 'beef  BRISKET (df)(gf)(h)': 'beef' })
  const result = optionRowsForVariant('Beef  Brisket (DF)(GF)(H)', 'p1', index)
  assert.equal(result.rows.length, 1, 'alias lookup ignores case and extra whitespace')
}

// --- pack size ------------------------------------------------------------

{
  const index = indexOf([beef])
  index.portionSize.set('big', 8)
  const small = optionRowsForVariant('Beef Brisket', 'p1', index)
  const large = optionRowsForVariant('Beef Brisket', 'big', index)
  assert.equal(small.rows[0].quantity, 1)
  assert.equal(large.rows[0].quantity, 8, 'a bigger pack uses more of the same choice')
}

{
  const index = indexOf([beef])
  index.portionSize.set('big', 8)
  index.quantities.set('big:beef', 3)
  const result = optionRowsForVariant('Beef Brisket', 'big', index)
  assert.equal(result.rows[0].quantity, 3, 'an explicit per-product quantity beats the pack size')
}

{
  const index = indexOf([noServeware])
  index.portionSize.set('big', 8)
  const result = optionRowsForVariant('No Serveware', 'big', index)
  assert.deepEqual(result.rows, [], 'scaling nothing still costs nothing')
}

// An option that nobody has costed yet must stay visible as a gap rather than
// quietly resolving to zero.
{
  const index = indexOf([option('lamb', 'Roasted Lamb', [])])
  const result = optionRowsForVariant('Roasted Lamb', 'p1', index)
  assert.deepEqual(result.rows, [])
  assert.equal(result.uncosted.length, 1)
  assert.equal(result.freeOfCharge.length, 0, 'uncosted is not the same as free')
}

// --- migration safety -----------------------------------------------------

// The whole point of the merge: an ingredient an option now supplies must not
// also be counted from the legacy per-variant bag.
{
  const legacy = [item('Beef - portion', 1, 41.78), item('Packaging', 2, 0.5)]
  const fromOptions = [item('Beef - portion', 3, 41.78)]
  const residual = residualLegacyRows(legacy, fromOptions)
  assert.deepEqual(residual.map((r) => r.name), ['Packaging'], 'superseded rows drop, the rest survive')
}

{
  const legacy = [item('Packaging', 1)]
  assert.deepEqual(
    residualLegacyRows(legacy, []),
    legacy,
    'a variant whose choices are all uncosted keeps every legacy row'
  )
}

// --- row identity ---------------------------------------------------------

assert.equal(
  rowKey({ source: 'Components', id: 'abc', name: 'Beef' }),
  rowKey({ source: 'components', id: 'ABC', name: 'Something else' }),
  'identity is the catalogue reference, not the label'
)
assert.notEqual(
  rowKey({ source: 'Components', id: 'abc' }),
  rowKey({ source: 'Gilmours', id: 'abc' }),
  'the same id at two suppliers is two different things'
)
assert.equal(
  rowKey({ source: 'Other', name: 'Napkins' }),
  rowKey({ source: 'Other', name: ' napkins ' }),
  'rows written before ids were captured fall back to the name'
)

// --- spelling collapse ----------------------------------------------------

assert.equal(
  normalizeOptionKey('Beef Brisket (DF)(GF)(H)'),
  normalizeOptionKey('Beef brisket (GF DF Halal)'),
  'dietary qualifiers distinguish menu copy, not ingredients'
)
assert.notEqual(
  normalizeOptionKey('Korean Fried Chicken'),
  normalizeOptionKey('Chicken (DF)'),
  'different dishes must not collapse into one another'
)

console.log('costing options tests passed')
