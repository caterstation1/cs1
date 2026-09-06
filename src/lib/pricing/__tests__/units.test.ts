import assert from 'node:assert/strict'
import {
  canonicalFor,
  convert,
  fromLegacyOutputUnit,
  isCountUnit,
  normalizeUnitToken,
  toCanonical,
  toCanonicalLoose,
  toLegacyOutputUnit,
  unitKind,
} from '../units'

function approx(actual: number | null, expected: number, message: string) {
  assert.ok(actual != null, `${message}: expected ~${expected}, got null`)
  assert.ok(
    Math.abs((actual as number) - expected) < 1e-9,
    `${message}: expected ~${expected}, got ${actual}`
  )
}

function run() {
  // --- kinds ---
  for (const unit of ['kg', 'KG', 'Kg ', 'kilograms', 'g', 'grams', 'mg']) {
    assert.equal(unitKind(unit), 'mass', `${unit} should be mass`)
  }
  for (const unit of ['l', 'L', 'litre', 'liters', 'ml', 'ML']) {
    assert.equal(unitKind(unit), 'volume', `${unit} should be volume`)
  }
  for (const unit of ['each', 'ea', 'unit', 'units', 'pc', 'pack', 'ctn', 'bottle']) {
    assert.equal(unitKind(unit), 'count', `${unit} should be count`)
  }
  assert.equal(unitKind(''), null)
  assert.equal(unitKind(null), null)
  assert.equal(unitKind('banana'), null)
  assert.equal(unitKind('portionz'), null)

  assert.equal(normalizeUnitToken(' KG. '), 'kg')
  assert.equal(canonicalFor('g'), 'kg')
  assert.equal(canonicalFor('ml'), 'l')
  assert.equal(canonicalFor('pc'), 'each')
  assert.equal(canonicalFor('nonsense'), null)
  assert.equal(isCountUnit('each'), true)
  assert.equal(isCountUnit('kg'), false)

  // --- toCanonical ---
  const grams = toCanonical(500, 'g')
  assert.equal(grams?.unit, 'kg')
  approx(grams?.qty ?? null, 0.5, '500 g in kg')

  const millilitres = toCanonical(330, 'ml')
  assert.equal(millilitres?.unit, 'l')
  approx(millilitres?.qty ?? null, 0.33, '330 ml in l')

  const pieces = toCanonical(3, 'each')
  assert.equal(pieces?.unit, 'each')
  approx(pieces?.qty ?? null, 3, '3 each')

  assert.equal(toCanonical(1, 'banana'), null, 'unknown unit must not silently become a count')
  assert.equal(toCanonical(Number.NaN, 'kg'), null)

  // Loose form keeps the old toBase behaviour, but only where the old code
  // already relied on it (Component.producedUnit).
  const loose = toCanonicalLoose(4, 'portionz')
  assert.equal(loose.unit, 'each')
  approx(loose.qty, 4, 'loose fallback keeps the quantity')

  // --- convert ---
  approx(convert(1000, 'g', 'kg'), 1, 'g -> kg')
  approx(convert(1, 'kg', 'g'), 1000, 'kg -> g')
  approx(convert(500, 'ml', 'l'), 0.5, 'ml -> l')
  approx(convert(2.5, 'kg', 'kg'), 2.5, 'kg -> kg')
  approx(convert(6, 'each', 'each'), 6, 'each -> each')

  // The whole point: kind mismatches are null, never a number.
  assert.equal(convert(1, 'kg', 'l'), null, 'mass -> volume must be null')
  assert.equal(convert(1, 'l', 'kg'), null, 'volume -> mass must be null')
  assert.equal(convert(1, 'each', 'kg'), null, 'count -> mass must be null')
  assert.equal(convert(1, 'kg', 'each'), null, 'mass -> count must be null')
  assert.equal(convert(1, 'kg', 'banana'), null, 'unknown target must be null')
  assert.equal(convert(1, 'banana', 'kg'), null, 'unknown source must be null')

  // --- legacy spellings ---
  assert.equal(toLegacyOutputUnit('each'), 'unit')
  assert.equal(toLegacyOutputUnit('kg'), 'kg')
  assert.equal(toLegacyOutputUnit('l'), 'l')
  assert.equal(fromLegacyOutputUnit('unit'), 'each')
  assert.equal(fromLegacyOutputUnit('kg'), 'kg')
  assert.equal(fromLegacyOutputUnit(null), 'each')

  console.log('pricing units tests passed')
}

run()
