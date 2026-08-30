import assert from 'node:assert/strict'
import { CostIndexInput, createCostIndex } from '../../pricing/resolve'
import { TreeNode, buildRecipeTree } from '../../pricing/tree'
import {
  LineTarget,
  isEditableOrigin,
  locateRow,
  locateRows,
  notEditableReason,
  patchRow,
  readRecipeRows,
  removeRow,
  removeRows,
  replaceRow,
  rowRefId,
} from '../lines'

function row(source: string, id: string, name: string, quantity = 1, unit: string | null = 'unit') {
  return { source, id, name, quantity, unit, cost: 0 }
}

function target(origin: LineTarget['origin'], position: number, refId: string): LineTarget {
  return { origin, position, refId }
}

// --- reading the stored array ---------------------------------------------

{
  // Positions are counted over the raw array, so an unusable row must keep its
  // slot: dropping it here would shift every line after it.
  const stored = [row('Other', 'a', 'A'), null, 'junk', row('Other', 'b', 'B')]
  const rows = readRecipeRows(stored)
  assert.equal(rows.length, 4, 'every slot survives, usable or not')
  assert.equal(rowRefId(rows[3]), 'b', 'the fourth slot is still the fourth slot')
  assert.equal(readRecipeRows(null).length, 0)
  assert.equal(readRecipeRows({ not: 'an array' }).length, 0)
}

{
  assert.equal(rowRefId({ sku: 'SKU-1' }), 'SKU-1', 'the parser\u2019s id fallbacks are honoured')
  assert.equal(rowRefId({ productCode: 'PC-1' }), 'PC-1')
  assert.equal(rowRefId(null), '')
}

// --- which arrays can be written ------------------------------------------

{
  assert.ok(isEditableOrigin('base'))
  assert.ok(isEditableOrigin('variant'))
  assert.ok(isEditableOrigin('component'))
  assert.ok(!isEditableOrigin('option'), 'option rows come from the costing catalogue')
  assert.ok(!isEditableOrigin('bundle'), 'bundle rows come from pack contents')
  assert.match(notEditableReason('option'), /product title/)
  assert.match(notEditableReason('bundle'), /party pack/)
}

// --- locating one row -----------------------------------------------------

{
  const rows = readRecipeRows([row('Other', 'a', 'A'), row('Other', 'b', 'B'), row('Other', 'c', 'C')])

  const found = locateRow(rows, target('base', 1, 'b'))
  assert.ok(found.ok)
  assert.equal(found.index, 1)
  assert.equal(found.row.name, 'B')

  const past = locateRow(rows, target('base', 7, 'b'))
  assert.ok(!past.ok)
  assert.equal(past.status, 409)
  assert.match(past.error, /no longer at position 7 of 3/)

  const moved = locateRow(rows, target('base', 1, 'a'))
  assert.ok(!moved.ok, 'a ref that no longer matches is refused rather than guessed at')
  assert.equal(moved.status, 409)
  assert.match(moved.error, /changed since the page loaded/)

  const hole = locateRow(readRecipeRows([row('Other', 'a', 'A'), null]), target('base', 1, ''))
  assert.ok(!hole.ok)
}

// --- removing a line that is not the first one ----------------------------

{
  const rows = readRecipeRows([
    row('Other', 'station', 'Large station'),
    row('Other', 'card', 'Insert card box', 3),
    row('Components', 'slaw', 'Large Slaw'),
    row('Components', 'mayo', 'Large Mayo'),
  ])

  const found = locateRow(rows, target('base', 2, 'slaw'))
  assert.ok(found.ok)
  const after = removeRow(rows, found.index) as Array<{ name: string }>

  assert.deepEqual(
    after.map((r) => r.name),
    ['Large station', 'Insert card box', 'Large Mayo'],
    'the third line goes and nothing else moves out of order'
  )
}

// --- two lines referencing the same thing delete independently ------------

{
  const rows = readRecipeRows([
    row('Components', 'beef', 'Beef - portion'),
    row('Components', 'mayo', 'Large Mayo'),
    // The same ingredient twice: a recipe may legitimately list it in two
    // places, and each is its own line.
    row('Components', 'beef', 'Beef - portion', 2),
  ])

  const second = locateRow(rows, target('variant', 2, 'beef'))
  assert.ok(second.ok)
  assert.equal(second.row.quantity, 2, 'position, not the ref, decides which duplicate is addressed')

  const after = removeRow(rows, second.index) as Array<{ id: string; quantity: number }>
  assert.equal(after.length, 2)
  assert.deepEqual(
    after.map((r) => `${r.id}:${r.quantity}`),
    ['beef:1', 'mayo:1'],
    'the duplicate that was clicked goes and the other one survives'
  )

  const first = locateRow(rows, target('variant', 0, 'beef'))
  assert.ok(first.ok)
  const alt = removeRow(rows, first.index) as Array<{ id: string; quantity: number }>
  assert.deepEqual(alt.map((r) => `${r.id}:${r.quantity}`), ['mayo:1', 'beef:2'])
}

// --- update, replace, and the multi-line wrap -----------------------------

{
  const rows = readRecipeRows([row('Other', 'a', 'A'), row('Other', 'b', 'B'), row('Other', 'c', 'C')])

  const patched = patchRow(rows, 1, { quantity: 5 }) as Array<{ id: string; quantity: number }>
  assert.deepEqual(patched.map((r) => `${r.id}:${r.quantity}`), ['a:1', 'b:5', 'c:1'])

  const swapped = replaceRow(rows, 2, row('Components', 'z', 'Z')) as Array<{ id: string }>
  assert.deepEqual(swapped.map((r) => r.id), ['a', 'b', 'z'])

  const many = locateRows(rows, [target('base', 2, 'c'), target('base', 0, 'a')])
  assert.ok(many.ok)
  assert.deepEqual(many.indexes, [2, 0], 'targets are resolved in the order they were sent')
  const kept = removeRows(rows, many.indexes) as Array<{ id: string }>
  assert.deepEqual(kept.map((r) => r.id), ['b'])

  const duplicated = locateRows(rows, [target('base', 1, 'b'), target('base', 1, 'b')])
  assert.ok(duplicated.ok)
  assert.deepEqual(duplicated.indexes, [1], 'the same line named twice is one line')

  const bad = locateRows(rows, [target('base', 0, 'a'), target('base', 9, 'x')])
  assert.ok(!bad.ok)
}

// --- the regression: rendered order is not stored order -------------------
//
// A station product's lines are the product's baseIngredients, then the rows
// the title's options contribute, then the variant's own rows. The rendered
// list is that concatenation, so a rendered index addresses nothing.

const BASE = [
  row('Other', 'station', 'Large station'),
  row('Other', 'card', 'Insert card box', 3),
  row('Components', 'slaw', 'Large Slaw'),
  row('Components', 'mayo', 'Large Mayo'),
  row('Components', 'onion', 'Large Red onion'),
  row('Components', 'tortillas', 'Large Taco- tortillas'),
]
const OPTION = [row('Components', 'porkbelly', 'Pork belly portion')]
const OWN = [row('Components', 'serveware', 'serveware - 25'), row('Components', 'beef', 'Beef - portion')]

function tacoStationNodes(): TreeNode[] {
  const input: CostIndexInput = {
    variants: [
      {
        id: 'pk-1',
        variantId: '43025218044159',
        productId: 'prod-1',
        shopifyTitle: 'Taco Station',
        shopifyPrice: 479,
        ingredients: OWN,
        optionIngredients: OPTION,
        product: { baseIngredients: BASE },
      },
    ],
  }
  const tree = buildRecipeTree('product', '43025218044159', createCostIndex(input))
  assert.ok(tree, 'the variant is in the index')
  return tree.nodes
}

{
  const nodes = tacoStationNodes()

  assert.equal(nodes.length, 9, 'six base rows, one option row, two of the variant\u2019s own')
  assert.deepEqual(
    nodes.map((n) => `${n.origin}:${n.position}`),
    ['base:0', 'base:1', 'base:2', 'base:3', 'base:4', 'base:5', 'option:0', 'variant:0', 'variant:1'],
    'each rendered row carries the array it came from and its index there'
  )

  // The bug: the row a user clicks is not stored where the page had it. Six of
  // the nine rendered rows live on the product, one is derived and cannot be
  // edited at all, and only the last two are in the variant's own array.
  const ownRows = readRecipeRows(OWN)
  assert.ok(
    locateRow(ownRows, target('variant', 3, 'mayo')).ok === false,
    'a rendered index of 3 against the variant array is out of range — the reported error'
  )
  assert.equal(rowRefId(ownRows[0]), 'serveware')
  assert.notEqual(nodes[0].refId, rowRefId(ownRows[0]), 'and a rendered index of 0 would have deleted the wrong line')
}

// Deleting the fourth rendered row must remove Large Mayo from the product's
// base recipe and leave the variant's own rows alone.
{
  const nodes = tacoStationNodes()
  const clicked = nodes[3]
  assert.equal(clicked.name, 'Large Mayo')
  assert.equal(clicked.origin, 'base')

  const baseRows = readRecipeRows(BASE)
  const found = locateRow(baseRows, target(clicked.origin, clicked.position, clicked.refId))
  assert.ok(found.ok)
  const after = removeRow(baseRows, found.index) as Array<{ name: string }>
  assert.deepEqual(
    after.map((r) => r.name),
    ['Large station', 'Insert card box', 'Large Slaw', 'Large Red onion', 'Large Taco- tortillas'],
    'exactly the clicked line is gone from the base recipe'
  )
  assert.deepEqual(readRecipeRows(OWN).length, 2, 'the variant\u2019s own rows are untouched')
}

// An expanded nested component does not change any top-level address: the
// children live in the component's own array and are addressed against it.
{
  const input: CostIndexInput = {
    components: [
      {
        id: 'comp-slaw',
        name: 'Large Slaw',
        ingredients: [row('Other', 'cabbage', 'Cabbage'), row('Other', 'carrot', 'Carrot')],
        producedQuantity: 1,
        producedUnit: 'unit',
      },
    ],
    variants: [
      {
        id: 'pk-1',
        variantId: 'v1',
        productId: 'prod-1',
        shopifyTitle: 'Taco Station',
        shopifyPrice: 479,
        ingredients: OWN,
        optionIngredients: [],
        product: { baseIngredients: [row('Other', 'station', 'Large station'), row('Components', 'comp-slaw', 'Large Slaw')] },
      },
    ],
  }
  const tree = buildRecipeTree('product', 'v1', createCostIndex(input))
  assert.ok(tree)
  const [station, slaw, ...rest] = tree.nodes
  assert.deepEqual(`${station.origin}:${station.position}`, 'base:0')
  assert.deepEqual(`${slaw.origin}:${slaw.position}`, 'base:1')
  assert.deepEqual(
    rest.map((n) => `${n.origin}:${n.position}`),
    ['variant:0', 'variant:1'],
    'the variant rows keep their own addresses whether or not the component above them is open'
  )
  assert.deepEqual(
    (slaw.children ?? []).map((c) => `${c.origin}:${c.position}`),
    ['component:0', 'component:1'],
    'a nested row is addressed against its own component'
  )
}

console.log('✅ recipe-builder line addressing tests passed')
