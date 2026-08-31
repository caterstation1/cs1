import assert from 'node:assert/strict'
import { parseCsvRows } from '../csv'

// The row that caused Panko Breadcrumbs to cost $0.00: the sub-category holds a
// comma, so a naive split shifted Price onto the UoM column.
{
  const text =
    '"Purchase date","SKU","Brand","Product description","Category","Sub Category","Pack size","UoM","Price","Qty"\n' +
    '"1 May 2026","5285932","Double Phoenix","Panko Breadcrumbs","Baking Ingredients","Crumbs, Coatings & Stuffing","10kg","Each","$52.94","1"'
  const rows = parseCsvRows(text)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].length, 10, 'quoted comma must not create an extra column')
  assert.equal(rows[1][5], 'Crumbs, Coatings & Stuffing')
  assert.equal(rows[1][6], '10kg')
  assert.equal(rows[1][7], 'Each')
  assert.equal(rows[1][8], '$52.94')
}

{
  const rows = parseCsvRows('a,b\r\n1,2\r\n')
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', '2'],
  ], 'CRLF endings must not produce blank rows')
}

{
  const rows = parseCsvRows('"say ""hi""",plain')
  assert.deepEqual(rows, [['say "hi"', 'plain']], 'doubled quotes are one escaped quote')
}

{
  const rows = parseCsvRows('\uFEFF"SKU","Brand"\n"1","x"')
  assert.equal(rows[0][0], 'SKU', 'BOM must be stripped from the first header')
}

{
  const rows = parseCsvRows('a,b\n\n\nc,d')
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['c', 'd'],
  ], 'blank lines are dropped')
}

{
  const rows = parseCsvRows('"multi\nline",second')
  assert.deepEqual(rows, [['multi\nline', 'second']], 'newline inside quotes stays in the field')
}

console.log('csv parser tests passed')
