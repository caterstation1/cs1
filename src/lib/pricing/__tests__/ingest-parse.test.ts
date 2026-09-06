import assert from 'node:assert/strict'
import { normalizeUom } from '../ingest/apply'
import { identifySupplier } from '../ingest/identify'
import {
  parseBidfoodCsv,
  parseBidfoodFullReportCsv,
  parseBidfoodInvoiceText,
  parseGenericCsv,
  parseGilmoursCsv,
  parseGilmoursOrderText,
  parseHtmlTables,
  parseMoney,
  parseProduceCoCsv,
  parseProduceCoOrderText,
  splitTrailingPackSize,
} from '../ingest/parse'

function run() {
  // --- money ---
  assert.equal(parseMoney('$1,234.50'), 1234.5)
  assert.equal(parseMoney(' 12.30 '), 12.3)
  assert.ok(Number.isNaN(parseMoney('')))
  assert.ok(Number.isNaN(parseMoney('call for price')))

  // --- supplier identification ---
  assert.equal(identifySupplier({ from: 'orders@bidfood.co.nz', subject: 'x' }), 'bidfood')
  assert.equal(identifySupplier({ from: 'noreply@gilmours.co.nz', subject: 'x' }), 'gilmours')
  assert.equal(
    identifySupplier({ from: 'peter@caterstation.co.nz', subject: 'Fwd: Your Gilmours order', text: 'Gilmours order 123' }),
    'gilmours'
  )
  assert.equal(
    identifySupplier({ from: 'peter@caterstation.co.nz', subject: 'Order confirmation', text: 'The Produce Company — thanks for your order' }),
    'produceco'
  )
  assert.equal(identifySupplier({ from: 'random@example.com', subject: 'hello', text: 'nothing relevant' }), null)

  // --- Gilmours CSV ---
  const gilmours = parseGilmoursCsv(
    ['SKU,Brand,Description,Pack Size,UOM,Price,Quantity', '5260445,Anchor,Butter Unsalted,10x1kg,CTN,"$112.50",2', ',Bad,No sku,1kg,EA,5.00,1'].join('\n')
  )
  assert.ok(gilmours, 'gilmours csv should parse')
  assert.equal(gilmours!.parser, 'gilmours-csv')
  assert.equal(gilmours!.structured, true)
  assert.equal(gilmours!.rows.length, 1)
  assert.equal(gilmours!.rows[0].sku, '5260445')
  assert.equal(gilmours!.rows[0].price, 112.5)

  // --- Bidfood CSV (duplicate codes keep the cheaper row, like the manual upload) ---
  const bidfood = parseBidfoodCsv(
    [
      'Product Code,Brand,Description,Pack Size,Ctn Qty,UOM,Qty,Last Price Paid,Total ExGST,Contains',
      '84578,Tegel,Chicken Breast,2kg,6,CTN,1,$45.20,45.20,',
      '84578,Tegel,Chicken Breast,2kg,6,CTN,1,$44.00,44.00,',
    ].join('\n')
  )
  assert.ok(bidfood, 'bidfood csv should parse')
  assert.equal(bidfood!.rows.length, 1)
  assert.equal(bidfood!.rows[0].price, 44)

  // --- Produce Co CSV ---
  const produce = parseProduceCoCsv(
    ['Product Code,Product Name,Total Units,Total Sales,Price', '2HCHBSO,Basil 100g,4,48.00,12.00'].join('\n')
  )
  assert.ok(produce, 'produceco csv should parse')
  assert.equal(produce!.rows[0].sku, '2HCHBSO')
  assert.equal(produce!.rows[0].price, 12)

  // --- generic CSV requires price + (code or description) ---
  assert.equal(parseGenericCsv('a,b\n1,2'), null)
  const generic = parseGenericCsv('Item Code,Product,Unit Price\nX1,Flour High Grade,32.50')
  assert.ok(generic)
  assert.equal(generic!.structured, false)

  // --- HTML order-confirmation table ---
  const html = `
    <html><body><p>Thanks for your order</p>
    <table>
      <tr><th>Code</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
      <tr><td>5260445</td><td>Butter Unsalted 10x1kg</td><td>2</td><td>$112.50</td><td>$225.00</td></tr>
      <tr><td></td><td>Subtotal</td><td></td><td></td><td>$225.00</td></tr>
      <tr><td></td><td>Freight</td><td></td><td>$15.00</td><td>$15.00</td></tr>
    </table></body></html>`
  const table = parseHtmlTables(html)
  assert.ok(table, 'html table should parse')
  assert.equal(table!.parser, 'html-table')
  assert.equal(table!.rows.length, 1, 'subtotal and freight rows must be skipped')
  assert.equal(table!.rows[0].sku, '5260445')
  assert.equal(table!.rows[0].price, 112.5)
  assert.equal(table!.rows[0].quantity, 2)

  // Tables with no price column are ignored.
  assert.equal(parseHtmlTables('<table><tr><th>Name</th></tr><tr><td>x</td></tr></table>'), null)

  // --- Bidfood weekly "Full order report" (real format, Aug 2026) ---
  const fullReport = parseBidfoodFullReportCsv(
    [
      'Pack Size,Inners per Case,Carton Price,Brand,Unit Price,Product Code,Unit of Measure,Manufacturer,Carton Unit of Measure,Product Description,Product Category',
      '1KG,15,$264.81,Kitchen IQ,$17.65,172325,PKT,SOMEONE,CTN,Bacon Streaky,Meat',
      // No unit price → derived carton ÷ inners = 20.125
      '5L,2,$40.25,Chateau,,10020,EA,EMENZN,CTN,Ice Cream Vanilla,Ice Cream',
      // No unit price and no inners → skipped
      'RAND1,,,Kitchen IQ,,999999,KG,X,,Mystery Meat,Meat',
    ].join('\n')
  )
  assert.ok(fullReport, 'bidfood full report should parse')
  assert.equal(fullReport!.parser, 'bidfood-full-report')
  assert.equal(fullReport!.structured, false, 'full report must never create catalogue rows')
  assert.equal(fullReport!.fullRange, true)
  assert.equal(fullReport!.rows.length, 2)
  assert.equal(fullReport!.rows[0].sku, '172325')
  assert.equal(fullReport!.rows[0].price, 17.65, 'price must be Unit Price, not Carton Price')
  assert.equal(fullReport!.rows[0].packSize, '15X1KG', 'packSize follows the DB inners×pack convention')
  assert.equal(fullReport!.rows[1].price, 20.13, 'missing unit price derives from carton ÷ inners')

  // --- Gilmours order confirmation (item blocks, real format) ---
  const gilmoursOrder = parseGilmoursOrderText(
    'Order confirmation Thank you for ordering with Gilmours. ' +
      'Edgell Potato Gems 2kg Product Code: 5137496 Quantity 4.0 Each Price per Each $10.43 Total $41.72 ' +
      'Edgell Potato Gems 6 x 2kg Product Code: 5137496 Quantity 4.0 Case Price per Case $62.56 Total $250.24 ' +
      'Anchor Blue UHT Milk 12 x 1000ml Product Code: 1022429 Quantity 1.0 Case Price per Case $44.02 Total $44.02 ' +
      'Subtotal $476.78 Estimated GST $71.52'
  )
  assert.ok(gilmoursOrder, 'gilmours order should parse')
  assert.equal(gilmoursOrder!.parser, 'gilmours-order')
  assert.equal(gilmoursOrder!.rows.length, 3)
  const gems = gilmoursOrder!.rows.filter((r) => r.sku === '5137496')
  assert.equal(gems.length, 2, 'same SKU per Each and per Case must both survive parsing')
  assert.deepEqual(gems.map((r) => [r.uom, r.price]).sort(), [['case', 62.56], ['each', 10.43]])
  const milk = gilmoursOrder!.rows.find((r) => r.sku === '1022429')
  assert.equal(milk!.price, 44.02)

  // The name and pack size are what make a new Gilmours line usable as an
  // ingredient; without them a promoted row is called 'Gilmours 1090586'.
  assert.equal(gems[0].description, 'Edgell Potato Gems', 'the product name is read, not discarded')
  assert.equal(milk!.description, 'Anchor Blue UHT Milk')
  assert.equal(milk!.packSize, '12x1000ml', 'the pack is read so a per-litre cost can be derived')
  assert.deepEqual(gems.map((r) => r.packSize).sort(), ['2kg', '6x2kg'])

  // Price-before-code linearization still pairs, via the leftover pass.
  const flipped = parseGilmoursOrderText('Price per Case $62.56 Quantity 4.0 Product Code: 5137496 Total $250.24')
  assert.equal(flipped!.rows[0].price, 62.56)

  // Every item on a real 14-line confirmation, including the ones the old
  // code-to-nearest-price pairing dropped.
  const gilmoursReal = parseGilmoursOrderText(
    'Order part 1 of 1 14 items Delivery by Gilmours on Mon 7 Sep ' +
      "Delivery notes Product requests n/a Can I please add a 1kg box of 'the fresh grower' Coriander. Thanks " +
      'Janola Regular Premium Bleach 2.5L Product Code: 1090586 Quantity 1.0 Each Price per Each $5.72 Total $5.72 ' +
      'Coastal Blue Paper Towels 6 x 450 sheets Product Code: 5253280 Quantity 1.0 Each Price per Each $81.33 Total $81.33 ' +
      'Gilmours White Vinegar 4 x 5l Product Code: 1021756 Quantity 1.0 Case Price per Case $29.65 Total $29.65 ' +
      'Huhtamaki U-shape 250mL rPET Cold Wine Cup with Fill Line 50pk Product Code: 5329277 Quantity 3.0 Each Price per Each $6.05 Total $18.15 ' +
      'Tatua Sour Cream 12 x 1kg Product Code: 1036696 Quantity 1.0 Case Price per Case $90.71 Total $90.71 ' +
      'Subtotal $447.65 Deposits $0.00 Estimated GST $67.15 Estimate order total $514.80'
  )
  assert.ok(gilmoursReal, 'real gilmours confirmation should parse')
  assert.equal(gilmoursReal!.rows.length, 5, 'every item block is read')
  const byGilmoursSku = new Map(gilmoursReal!.rows.map((r) => [r.sku, r]))
  assert.equal(byGilmoursSku.get('1090586')!.description, 'Janola Regular Premium Bleach')
  assert.equal(byGilmoursSku.get('1090586')!.packSize, '2.5l')
  assert.equal(byGilmoursSku.get('5253280')!.packSize, '6x450sheets', 'a multiplied count pack is still a pack')
  assert.equal(
    byGilmoursSku.get('5329277')!.packSize,
    '50pk',
    'a measure inside the name must not beat the trailing pack'
  )
  assert.equal(byGilmoursSku.get('5329277')!.description, 'Huhtamaki U-shape 250mL rPET Cold Wine Cup with Fill Line')
  assert.equal(byGilmoursSku.get('5329277')!.price, 6.05, 'qty 3 at $6.05 reconciles against the $18.15 total')
  assert.equal(byGilmoursSku.get('1036696')!.uom, 'case')

  // --- trailing pack sizes ---
  assert.deepEqual(splitTrailingPackSize('Gilmours Premium Flour 20kg'), {
    description: 'Gilmours Premium Flour',
    packSize: '20kg',
  })
  assert.deepEqual(splitTrailingPackSize('Meadow Fresh Cream 2l'), { description: 'Meadow Fresh Cream', packSize: '2l' })
  assert.deepEqual(splitTrailingPackSize('Beetroot Red'), { description: 'Beetroot Red' })
  assert.deepEqual(splitTrailingPackSize('12 x 1kg'), { description: '12 x 1kg' }, 'a bare pack is not a name')

  // --- Produce Co order confirmation, forwarded as plain text ---
  const produceText = parseProduceCoOrderText(
    'Order Numbers: 537984 Ordered on 06 Sep, 2026 Orders Details: Delivery Date 07/09/2026 ' +
      'Total Value (Excluding GST) $413.68 Delivery Address: 562 Richmond Road Grey Lynn Auckland ' +
      'Items in Your Order *Code* *Description* *Qty* *Unit* *Price(exclGST)* *Total(exclGST)* ' +
      '2HCHBSL Chicken Breasts Skinless 12kg 2.00 Case $134.00 $268.00 ' +
      'BEE Beetroot Red 2.00 Kilo $5.20 $10.40 ' +
      'SHP Shallots Peeled 2.00 Kilo $18.99 $37.98 ' +
      'Pre-Ordered Products *Code* *Description* *Qty* *Unit* *Price(exclGST)* *Total(exclGST)* ' +
      'PCONIRSL Onion Red Sliced 2.5kg Estimated Delivery Date 08/09/2026 5.00 Each $19.46 $97.30 ' +
      'Kind Regards The Produce Company Free Phone: 0800 776-382 www.produce.co.nz'
  )
  assert.ok(produceText, 'produce co plain-text confirmation should parse')
  assert.equal(produceText!.parser, 'produceco-order')
  assert.equal(produceText!.structured, false, 'an order email must never create catalogue rows wholesale')
  assert.equal(produceText!.rows.length, 4, 'pre-ordered items count too')
  const byProduceSku = new Map(produceText!.rows.map((r) => [r.sku, r]))
  assert.equal(byProduceSku.get('2HCHBSL')!.price, 134, 'the unit price, not the line total')
  assert.equal(byProduceSku.get('2HCHBSL')!.description, 'Chicken Breasts Skinless')
  assert.equal(byProduceSku.get('2HCHBSL')!.packSize, '12kg')
  assert.equal(byProduceSku.get('2HCHBSL')!.uom, 'case')
  assert.equal(byProduceSku.get('BEE')!.description, 'Beetroot Red')
  assert.equal(byProduceSku.get('BEE')!.uom, 'kilo', 'a weight-priced line keeps its unit')
  assert.equal(byProduceSku.get('BEE')!.packSize, undefined)
  // The pre-ordered block puts a delivery date inside the description.
  assert.equal(byProduceSku.get('PCONIRSL')!.description, 'Onion Red Sliced')
  assert.equal(byProduceSku.get('PCONIRSL')!.packSize, '2.5kg')
  assert.equal(byProduceSku.get('PCONIRSL')!.price, 19.46)
  // Totals are the guard: a misread column set is dropped rather than trusted.
  assert.equal(
    parseProduceCoOrderText('Items in Your Order BEE Beetroot Red 2.00 Kilo $5.20 $999.99'),
    null,
    'qty x price must reconcile against the line total'
  )
  assert.equal(parseProduceCoOrderText('Just a newsletter with no order in it'), null)

  // --- Produce Co order confirmation table (real headers with excl GST) ---
  const produceOrder = parseHtmlTables(`
    <table>
      <tr><th>Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price (excl GST)</th><th>Total (excl GST)</th></tr>
      <tr><td>POA</td><td>Potato Agria Large</td><td>30.00</td><td>Kilo</td><td>$3.43</td><td>$102.96</td></tr>
      <tr><td>XEPICGY</td><td>Collective Greek Yoghurt 900g</td><td>1.00</td><td>Each</td><td>$7.99</td><td>$7.99</td></tr>
    </table>`)
  assert.ok(produceOrder, 'produce co order table should parse')
  assert.equal(produceOrder!.rows.length, 2)
  assert.equal(produceOrder!.rows[0].sku, 'POA')
  assert.equal(produceOrder!.rows[0].price, 3.43, 'must take unit price, not the line total')

  // --- Bidfood invoice email (real format, Aug 2026) ---
  const bidfoodInvoice = parseBidfoodInvoiceText(
    'Dear Peter Your order is now Invoiced. Please find current details below. ' +
      'Order No:2617754-1 SubTotal:$1725.53 GST:$258.83 Total:$1984.36 ' +
      'Products The following products are included in this shipment ' +
      'Product [Pack Size/UOM] Qty Price Subtotal ' +
      '108917 Muffin English Splits [36PC/Carton] 3.00 $20.96 $62.88 ' +
      '172325 Bacon Streaky Rindless ManukaSmoked Raw [15X1KG/Carton] 1.00 $264.81 $264.81 ' +
      '33404 Sour Cream [12X1KG/Packet] 4.00 $8.08 $32.32 ' +
      '88659 Pork Belly Boneless Skin On Free Range Vacuum Pack [RAND5/Kilo] 15.07 $21.78 $328.22 ' +
      '97602 Bread Roll White Gluten Free 450G [16X9PC/Carton] 1.00 $188.98 $188.98 ' +
      '71771 Plate Sugarcane White 18cm/10 Inch [10X50PC/Carton] 2.00 $68.80 $137.60 ' +
      'Thank you for your order!'
  )
  assert.ok(bidfoodInvoice, 'bidfood invoice should parse')
  assert.equal(bidfoodInvoice!.parser, 'bidfood-invoice')
  assert.equal(bidfoodInvoice!.structured, false, 'invoice emails must never create catalogue rows')
  assert.equal(bidfoodInvoice!.rows.length, 6)
  const bySku = new Map(bidfoodInvoice!.rows.map((r) => [r.sku, r]))
  // Carton price with pack multiplier → per-inner (matches catalogue basis).
  assert.equal(bySku.get('172325')!.price, 17.65, '264.81/carton ÷ 15 inners')
  assert.equal(bySku.get('97602')!.price, 11.81, '188.98/carton ÷ 16 inners')
  assert.equal(bySku.get('71771')!.price, 6.88, '68.80/carton ÷ 10 inners')
  // Carton with no multiplier, and per-Packet/Kilo lines pass through unchanged.
  assert.equal(bySku.get('108917')!.price, 20.96)
  assert.equal(bySku.get('33404')!.price, 8.08)
  assert.equal(bySku.get('88659')!.price, 21.78)
  assert.equal(bySku.get('88659')!.description, 'Pork Belly Boneless Skin On Free Range Vacuum Pack')
  // A misread line (qty × price ≠ subtotal) is rejected.
  const badLine = parseBidfoodInvoiceText('Invoiced 108917 Muffin [36PC/Carton] 3.00 $20.96 $999.99')
  assert.equal(badLine, null)

  // --- uom normalization used by apply() to skip Each-vs-Case mismatches ---
  assert.equal(normalizeUom('Case'), 'case')
  assert.equal(normalizeUom('CTN'), 'case')
  assert.equal(normalizeUom('Each'), 'each')
  assert.equal(normalizeUom('EA'), 'each')
  assert.equal(normalizeUom('Kilo'), 'kg')
  assert.equal(normalizeUom(''), null)

  console.log('✅ ingest-parse tests passed')
}

run()
