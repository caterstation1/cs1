import assert from 'node:assert/strict'
import {
  isAddonLine,
  isAddonSku,
  isCaterCase,
  isServewareLine,
  isServewareSelected,
  normalizeLineKind,
  resolveAddonPlacement,
  orderHasStandaloneServeware,
  showsServewareMarker,
} from '../line-item-kind'

// Addon SKUs
assert.equal(isAddonSku('ADD-CTT'), true)
assert.equal(isAddonSku('AA12'), true)
assert.equal(isAddonSku('SK20-BLN'), false)
assert.equal(isAddonSku(null), false)

// CaterCases: real cases from the catalogue
assert.equal(isCaterCase({ sku: 'CC02', title: 'TaterTots CaterCase' }), true)
assert.equal(isCaterCase({ sku: 'CC15', title: 'Pavlova CaterCase' }), true)
// No SKU at all, so the title has to carry it
assert.equal(isCaterCase({ sku: '', title: 'Soup CaterCase' }), true)
// Resolved from the product when the line is bare
assert.equal(isCaterCase({ sku: null, title: null }, { shopifySku: 'CC04' }), true)

// CC appears in plenty of station SKUs and must not be mistaken for a case
assert.equal(isCaterCase({ sku: 'CCDDN', title: 'Mid-Year Christmas Dipper Donut Station' }), false)
assert.equal(isCaterCase({ sku: 'SK20CCY', title: 'Buffalo Chicken Slider kit.' }), false)
assert.equal(isCaterCase({ sku: 'GYR20-CCN', title: 'Gyros Station' }), false)
assert.equal(isCaterCase({ sku: 'WLG-TK20-CCY', title: 'Taco Kit - 20 - 25ppl.' }), false)

// CaterCases list with the addons
assert.equal(isAddonLine({ sku: 'CC02', title: 'TaterTots CaterCase' }), true)
assert.equal(isAddonLine({ sku: 'ADD-TFN', title: 'ADDON: Side of Tofu' }), true)
assert.equal(isAddonLine({ sku: 'SK20-BY', title: 'Mini Slider Station' }), false)

// An explicit lineKind beats whatever the SKU says, in both directions
const donutKit = { sku: 'BAD20-N', title: 'Build-a-Donut Station' }
assert.equal(isAddonLine(donutKit, { lineKind: 'addon' }), true)
assert.equal(isAddonLine({ sku: 'ADD-TFN' }, { lineKind: 'product' }), false)
assert.equal(isAddonLine({ sku: 'CC02', title: 'TaterTots CaterCase' }, { lineKind: 'product' }), false)
// Blank or unrecognised values fall back to the SKU
assert.equal(isAddonLine({ sku: 'ADD-TFN' }, { lineKind: '' }), true)
assert.equal(isAddonLine(donutKit, { lineKind: 'nonsense' }), false)

assert.equal(normalizeLineKind('addon'), 'addon')
assert.equal(normalizeLineKind('Product'), 'product')
assert.equal(normalizeLineKind(''), null)
assert.equal(normalizeLineKind(undefined), null)

// The runsheet/labels/stock surfaces keep their own SKU rule and only borrow
// the override, so a CaterCase stays a product there unless told otherwise.
assert.equal(resolveAddonPlacement(false, { shopifySku: 'CC02' }), false)
assert.equal(resolveAddonPlacement(true, null), true)
assert.equal(resolveAddonPlacement(true, { lineKind: 'product' }), false)
assert.equal(resolveAddonPlacement(false, { lineKind: 'addon' }), true)
assert.equal(resolveAddonPlacement(false, { lineKind: '' }), false)

// Serveware sold as its own line
const servewareYes = { sku: '', title: 'Serveware', variant_title: 'Yes Serveware' }
const servewareNo = { sku: '', title: 'Serveware', variant_title: 'No Serveware' }
const slider = { sku: 'SK20-BLN', title: 'Slider Station', variant_title: 'Pulled Brisket / No Serveware' }

assert.equal(isServewareLine(servewareYes), true)
assert.equal(isServewareLine(servewareNo), true)
// A station whose variant mentions serveware is still a station
assert.equal(isServewareLine(slider), false)

assert.equal(isServewareSelected(servewareYes), true)
assert.equal(isServewareSelected(servewareNo), false)
// The product flag wins over the title when the variant is known
assert.equal(isServewareSelected(servewareNo, { serveware: true }), true)
assert.equal(isServewareSelected(slider, { serveware: true }), false)

// Order #13744: a standalone serveware line marks the stations
const order13744 = [
  { sku: 'ADD-CTT', title: 'ADDON: Crispy TaterTots' },
  servewareYes,
  slider,
  { sku: 'TK20-CPN', title: 'Taco Station', variant_title: 'Chicken / Pork Belly / No Serveware' },
]
const noProduct = () => null
assert.equal(orderHasStandaloneServeware(order13744, noProduct), true)
assert.equal(showsServewareMarker(null, slider, true), true)

// Without that line nothing is marked
assert.equal(orderHasStandaloneServeware([slider], noProduct), false)
assert.equal(showsServewareMarker(null, slider, false), false)
// A variant that includes serveware still marks itself
assert.equal(showsServewareMarker({ serveware: true }, slider, false), true)

console.log('line-item-kind tests passed')
