import assert from 'node:assert/strict'
import { deriveUnitPricing, parsePackSize, parsePackStructure } from '../packsize'

function approx(actual: number | null | undefined, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(actual != null, `${message}: expected ~${expected}, got ${actual}`)
  assert.ok(
    Math.abs((actual as number) - expected) < tolerance,
    `${message}: expected ~${expected}, got ${actual}`
  )
}

function run() {
  // --- multiplier packs ---
  const fourByThree = parsePackSize('4x3kg')
  assert.equal(fourByThree?.unitsPerPack, 4)
  approx(fourByThree?.sizePerUnit, 3, '4x3kg size per unit')
  assert.equal(fourByThree?.sizeUnit, 'kg')
  assert.equal(fourByThree?.canonicalUnit, 'kg')
  approx(fourByThree?.totalCanonicalQty, 12, '4x3kg total')
  assert.ok((fourByThree?.confidence ?? 0) >= 0.9, '4x3kg should parse with high confidence')

  const twelveBy500g = parsePackSize('12x500g')
  assert.equal(twelveBy500g?.unitsPerPack, 12)
  approx(twelveBy500g?.canonicalSizePerUnit, 0.5, '500g per piece in kg')
  approx(twelveBy500g?.totalCanonicalQty, 6, '12x500g total kg')

  const cans = parsePackSize('24x330ml')
  assert.equal(cans?.canonicalUnit, 'l')
  approx(cans?.totalCanonicalQty, 7.92, '24x330ml total litres')

  // Unicode multiplier and spaces, as supplier sheets actually write it.
  const spaced = parsePackSize('10 × 250g')
  assert.equal(spaced?.unitsPerPack, 10)
  approx(spaced?.totalCanonicalQty, 2.5, '10 x 250g total kg')

  // --- single measures ---
  const single = parsePackSize('2.5kg')
  assert.equal(single?.unitsPerPack, 1)
  approx(single?.sizePerUnit, 2.5, '2.5kg')
  approx(single?.totalCanonicalQty, 2.5, '2.5kg total')

  // --- counts ---
  const bare = parsePackSize('24')
  assert.equal(bare?.unitsPerPack, 24)
  assert.equal(bare?.canonicalUnit, 'each')
  const pieces = parsePackSize('6pc')
  assert.equal(pieces?.unitsPerPack, 6)
  assert.equal(pieces?.canonicalUnit, 'each')
  assert.equal(parsePackSize('each')?.canonicalUnit, 'each')

  // --- weight-priced and garbage ---
  const bareKg = parsePackSize('kg')
  assert.equal(bareKg?.canonicalUnit, 'kg')
  approx(bareKg?.totalCanonicalQty, 1, 'bare kg is one kilo')

  assert.equal(parsePackSize(''), null)
  assert.equal(parsePackSize(null), null)
  const garbage = parsePackSize('assorted mixed')
  assert.ok(garbage != null, 'garbage still returns a structure')
  assert.ok((garbage?.confidence ?? 1) <= 0.3, `garbage should be low confidence, got ${garbage?.confidence}`)

  // --- structure with UOM / ctnQty ---
  const bidfoodCase = parsePackStructure('6X2KG', 'CTN', '6')
  assert.equal(bidfoodCase.unitsPerPack, 6)
  approx(bidfoodCase.totalCanonicalQty, 12, 'Bidfood 6x2kg carton')
  assert.equal(bidfoodCase.pricedPer, 'pack')
  assert.ok(bidfoodCase.confidence >= 0.95, 'ctnQty agreeing with pack size should raise confidence')

  const disagreeing = parsePackStructure('6X2KG', 'CTN', '4')
  assert.ok(
    disagreeing.confidence <= 0.5,
    `ctnQty disagreeing with pack size should lower confidence, got ${disagreeing.confidence}`
  )

  const ctnOnly = parsePackStructure(null, 'CTN', '24')
  assert.equal(ctnOnly.unitsPerPack, 24)
  assert.equal(ctnOnly.canonicalUnit, 'each')

  const weightPriced = parsePackStructure('kg', 'KG', null)
  assert.equal(weightPriced.weightPriced, true)
  assert.equal(weightPriced.pricedPer, 'canonical')

  // --- derived pricing ---
  // The spec's worked example: a $10 carton of 3 x 2.5kg is 7.5kg at $1.3333/kg.
  const carton = deriveUnitPricing({ packSize: '3x2.5kg', uom: 'CTN', price: 10 })
  assert.equal(carton?.unit, 'kg')
  assert.equal(carton?.basis, 'per-pack')
  approx(carton?.unitCost, 10 / 7.5, 'carton of 3x2.5kg at $10')

  // Same pack, but the price is per piece rather than per carton. Reading it
  // per piece matches the existing behaviour; the ambiguity shows up as low
  // confidence rather than as a different number.
  const piece = deriveUnitPricing({ packSize: '3x2.5kg', uom: 'EACH', price: 10 })
  approx(piece?.unitCost, 4, 'one 2.5kg piece at $10 is $4/kg')
  assert.equal(piece?.basis, 'per-piece')
  assert.ok(
    (piece?.confidence ?? 1) <= 0.5,
    `a multi-piece pack with a single-piece UOM is ambiguous, got ${piece?.confidence}`
  )
  assert.ok(piece?.structure.notes.some((n) => n.includes('ambiguous')))

  // A single-piece pack with a piece UOM is not ambiguous.
  const unambiguousPiece = deriveUnitPricing({ packSize: '2.5kg', uom: 'BAG', price: 10 })
  approx(unambiguousPiece?.unitCost, 4, 'a 2.5kg bag at $10 is $4/kg')
  assert.ok((unambiguousPiece?.confidence ?? 0) >= 0.9, 'one bag of one size is unambiguous')

  // Already priced per kilo: pack structure must not divide it again.
  const perKilo = deriveUnitPricing({ packSize: '', uom: 'KG', price: 12.5 })
  approx(perKilo?.unitCost, 12.5, 'kg-priced item')
  assert.equal(perKilo?.basis, 'weight-priced')
  assert.equal(perKilo?.unit, 'kg')

  // Priced per gram restates as per kilo rather than being taken literally.
  const perGram = deriveUnitPricing({ packSize: '', uom: 'g', price: 0.0125 })
  approx(perGram?.unitCost, 12.5, 'g-priced item restated per kg')

  // Each-consumed goods: a carton of 24 divides down to a per-item cost.
  const eachCarton = deriveUnitPricing({ packSize: null, uom: 'CTN', ctnQty: '24', price: 48 })
  assert.equal(eachCarton?.unit, 'each')
  approx(eachCarton?.unitCost, 2, '$48 carton of 24')

  const bidfoodDerived = deriveUnitPricing({ packSize: '6X2KG', uom: 'CTN', ctnQty: '6', price: 60 })
  approx(bidfoodDerived?.unitCost, 5, 'Bidfood 6x2kg carton at $60 is $5/kg')
  assert.ok((bidfoodDerived?.confidence ?? 0) >= 0.95, 'Bidfood carton confidence')

  // Confidence survives a garbage pack size so callers can queue it for review
  // instead of trusting the number.
  const guessed = deriveUnitPricing({ packSize: 'assorted', uom: 'EACH', price: 9 })
  assert.equal(guessed?.unit, 'each')
  approx(guessed?.unitCost, 9, 'unparseable pack falls back to the raw price')
  assert.ok((guessed?.confidence ?? 1) <= 0.3, 'unparseable pack must report low confidence')

  assert.equal(deriveUnitPricing({ packSize: '1kg', uom: 'EACH', price: null }), null, 'no price means no cost')
  assert.equal(deriveUnitPricing({ packSize: '1kg', uom: 'EACH', price: 'not a number' }), null)

  console.log('pricing packsize tests passed')
}

run()
