// Deterministic row extraction for supplier price emails.
//
// Two shapes arrive here: full price-list CSVs (Bidfood weekly) and
// order-confirmation emails whose line items sit in an HTML table (Gilmours,
// Produce Co after every order). Everything is parsed defensively — email
// content is untrusted data, never instructions.

import Papa from 'papaparse'

export type SupplierId = 'gilmours' | 'bidfood' | 'produceco'

export interface ParsedPriceRow {
  /** Supplier's own code — Gilmours SKU, Bidfood/ProduceCo product code. */
  sku: string | null
  description: string
  brand?: string
  packSize?: string
  ctnQty?: string
  uom?: string
  quantity?: number
  /** Pack price ex GST, dollars. */
  price: number
}

export interface ParseOutcome {
  parser: string
  rows: ParsedPriceRow[]
  /** True when the source was a full structured price list (safe to create catalogue rows). */
  structured: boolean
  /**
   * True for a supplier's full-range list (e.g. Bidfood's weekly report covers
   * thousands of products Peter has never ordered). Rows absent from the
   * catalogue are then expected, not failures — and nothing is created.
   */
  fullRange?: boolean
}

export const MAX_ROWS_PER_INGESTION = 6000

/** Reject nonsense before it reaches the catalogue. */
export function isSanePrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 10000
}

const cleanCell = (value: unknown): string =>
  String(value ?? '')
    .replace(/^["']|["']$/g, '')
    .trim()

export function parseMoney(value: unknown): number {
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return NaN
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : NaN
}

function parseIntSafe(value: unknown): number {
  const parsed = parseInt(String(value ?? '').replace(/[$,\s]/g, ''), 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** CSV text → matrix of trimmed cells. Papaparse handles quoted commas. */
function toMatrix(csvText: string): string[][] {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
  return (result.data ?? []).map((row) => row.map(cleanCell))
}

// ---------------------------------------------------------------------------
// Supplier CSV parsers — ported from the client tabs so an emailed CSV lands
// exactly the way a manual upload would.
// ---------------------------------------------------------------------------

/** Gilmours export: SKU, brand, description, pack size, UOM, price, quantity. */
export function parseGilmoursCsv(csvText: string): ParseOutcome | null {
  const rows = toMatrix(csvText)
  if (rows.length < 2) return null
  const headers = rows[0].map((h) => h.toLowerCase())

  const skuIdx = headers.findIndex((h) => h.includes('sku'))
  const brandIdx = headers.findIndex((h) => h.includes('brand'))
  const descIdx = headers.findIndex((h) => h.includes('desc'))
  const packIdx = headers.findIndex((h) => h.includes('pack') && h.includes('size'))
  const uomIdx = headers.findIndex((h) => h.includes('uom') || h.includes('unit'))
  const priceIdx = headers.findIndex((h) => h.includes('price'))
  const qtyIdx = headers.findIndex((h) => h.includes('qty') || h.includes('quantity'))
  if (skuIdx < 0 || priceIdx < 0) return null

  const out: ParsedPriceRow[] = []
  for (const row of rows.slice(1, MAX_ROWS_PER_INGESTION + 1)) {
    const sku = cleanCell(row[skuIdx])
    const price = parseMoney(row[priceIdx])
    if (!sku || !isSanePrice(price)) continue
    out.push({
      sku,
      description: descIdx >= 0 ? cleanCell(row[descIdx]) : '',
      brand: brandIdx >= 0 ? cleanCell(row[brandIdx]) : undefined,
      packSize: packIdx >= 0 ? cleanCell(row[packIdx]) : undefined,
      uom: uomIdx >= 0 ? cleanCell(row[uomIdx]) : undefined,
      quantity: qtyIdx >= 0 ? parseIntSafe(row[qtyIdx]) : undefined,
      price,
    })
  }
  return out.length ? { parser: 'gilmours-csv', rows: out, structured: true } : null
}

/**
 * Bidfood export: productCode, brand, description, packSize, ctnQty, uom,
 * qty, lastPricePaid, totalExGST, contains. Header-sniffed with the client
 * tab's positional order as fallback.
 */
export function parseBidfoodCsv(csvText: string): ParseOutcome | null {
  const rows = toMatrix(csvText)
  if (rows.length < 2) return null
  const headers = rows[0].map((h) => h.toLowerCase())

  const findIdx = (fallback: number, ...tests: Array<(h: string) => boolean>): number => {
    for (const test of tests) {
      const idx = headers.findIndex(test)
      if (idx >= 0) return idx
    }
    return fallback
  }

  const codeIdx = findIdx(0, (h) => h.includes('code'))
  const brandIdx = findIdx(1, (h) => h.includes('brand'))
  const descIdx = findIdx(2, (h) => h.includes('desc'))
  const packIdx = findIdx(3, (h) => h.includes('pack'))
  const ctnIdx = findIdx(4, (h) => h.includes('ctn'))
  const uomIdx = findIdx(5, (h) => h.includes('uom') || h === 'unit')
  const qtyIdx = findIdx(6, (h) => h === 'qty' || h.includes('quantity'))
  const priceIdx = findIdx(7, (h) => h.includes('last price'), (h) => h.includes('price'))

  const out: ParsedPriceRow[] = []
  const best = new Map<string, ParsedPriceRow>()
  for (const row of rows.slice(1, MAX_ROWS_PER_INGESTION + 1)) {
    const sku = cleanCell(row[codeIdx])
    const price = parseMoney(row[priceIdx])
    if (!sku || !isSanePrice(price)) continue
    const parsed: ParsedPriceRow = {
      sku,
      description: cleanCell(row[descIdx]),
      brand: cleanCell(row[brandIdx]) || undefined,
      packSize: cleanCell(row[packIdx]) || undefined,
      ctnQty: cleanCell(row[ctnIdx]) || undefined,
      uom: cleanCell(row[uomIdx]) || undefined,
      quantity: parseIntSafe(row[qtyIdx]),
      price,
    }
    // Duplicate codes: keep the cheaper row, matching the manual upload's rule.
    const existing = best.get(sku)
    if (!existing || parsed.price < existing.price) best.set(sku, parsed)
  }
  out.push(...best.values())
  return out.length ? { parser: 'bidfood-csv', rows: out, structured: true } : null
}

/**
 * Bidfood's weekly "Full order report": Pack Size, Inners per Case, Carton
 * Price, Brand, Unit Price, Product Code, Unit of Measure, Manufacturer,
 * Carton Unit of Measure, Product Description, Product Category.
 *
 * The catalogue's lastPricePaid matches this file's **Unit Price** (per
 * inner), and the catalogue packSize convention is `${inners}X${pack}`
 * (verified against live data, e.g. DB '15X1KG' = file pack '1KG' × 15
 * inners). When Unit Price is blank it is derived as carton ÷ inners.
 */
export function parseBidfoodFullReportCsv(csvText: string): ParseOutcome | null {
  const rows = toMatrix(csvText)
  if (rows.length < 2) return null
  const headers = rows[0].map((h) => h.toLowerCase())

  const codeIdx = headers.findIndex((h) => h === 'product code')
  const unitPriceIdx = headers.findIndex((h) => h === 'unit price')
  const cartonPriceIdx = headers.findIndex((h) => h === 'carton price')
  const innersIdx = headers.findIndex((h) => h.includes('inners'))
  const packIdx = headers.findIndex((h) => h === 'pack size')
  const brandIdx = headers.findIndex((h) => h === 'brand')
  const descIdx = headers.findIndex((h) => h.includes('description'))
  const uomIdx = headers.findIndex((h) => h === 'unit of measure')
  if (codeIdx < 0 || unitPriceIdx < 0 || cartonPriceIdx < 0) return null

  const out: ParsedPriceRow[] = []
  for (const row of rows.slice(1, MAX_ROWS_PER_INGESTION + 1)) {
    const sku = cleanCell(row[codeIdx])
    if (!sku) continue

    let price = parseMoney(row[unitPriceIdx])
    const inners = parseIntSafe(row[innersIdx])
    if (!Number.isFinite(price)) {
      const carton = parseMoney(row[cartonPriceIdx])
      if (Number.isFinite(carton) && inners > 0) price = carton / inners
    }
    if (!isSanePrice(price)) continue

    const pack = packIdx >= 0 ? cleanCell(row[packIdx]) : ''
    out.push({
      sku,
      description: descIdx >= 0 ? cleanCell(row[descIdx]) : '',
      brand: brandIdx >= 0 ? cleanCell(row[brandIdx]) || undefined : undefined,
      packSize: inners > 1 ? `${inners}X${pack}`.toUpperCase() : pack,
      ctnQty: inners > 0 ? String(inners) : undefined,
      uom: uomIdx >= 0 ? cleanCell(row[uomIdx]) || undefined : undefined,
      price: Math.round(price * 100) / 100,
    })
  }
  // Update-only: this file spans Bidfood's whole range, not Peter's purchases.
  return out.length ? { parser: 'bidfood-full-report', rows: out, structured: false, fullRange: true } : null
}

/** Produce Co export: Product Code, Product Name, Price (Total Units/Sales optional). */
export function parseProduceCoCsv(csvText: string): ParseOutcome | null {
  const rows = toMatrix(csvText)
  if (rows.length < 2) return null
  const headers = rows[0].map((h) => h.toLowerCase())

  const codeIdx = headers.findIndex((h) => h.includes('code'))
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('desc'))
  const priceIdx = headers.findIndex((h) => h.includes('price'))
  if (codeIdx < 0 || priceIdx < 0) return null

  const out: ParsedPriceRow[] = []
  for (const row of rows.slice(1, MAX_ROWS_PER_INGESTION + 1)) {
    const sku = cleanCell(row[codeIdx])
    const price = parseMoney(row[priceIdx])
    if (!sku || !isSanePrice(price)) continue
    out.push({ sku, description: nameIdx >= 0 ? cleanCell(row[nameIdx]) : '', price })
  }
  return out.length ? { parser: 'produceco-csv', rows: out, structured: true } : null
}

/** Last-resort CSV: any sheet with a code-ish column and a price-ish column. */
export function parseGenericCsv(csvText: string): ParseOutcome | null {
  const rows = toMatrix(csvText)
  if (rows.length < 2) return null
  const headers = rows[0].map((h) => h.toLowerCase())

  const codeIdx = headers.findIndex((h) => h.includes('sku') || h.includes('code') || h.includes('item no'))
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('name') || h.includes('product'))
  const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('unit cost'))
  if (priceIdx < 0 || (codeIdx < 0 && descIdx < 0)) return null

  const out: ParsedPriceRow[] = []
  for (const row of rows.slice(1, MAX_ROWS_PER_INGESTION + 1)) {
    const sku = codeIdx >= 0 ? cleanCell(row[codeIdx]) : ''
    const description = descIdx >= 0 ? cleanCell(row[descIdx]) : ''
    const price = parseMoney(row[priceIdx])
    if ((!sku && !description) || !isSanePrice(price)) continue
    out.push({ sku: sku || null, description, price })
  }
  return out.length ? { parser: 'generic-csv', rows: out, structured: false } : null
}

export function parseCsvForSupplier(supplier: SupplierId | null, csvText: string): ParseOutcome | null {
  if (supplier === 'gilmours') return parseGilmoursCsv(csvText) ?? parseGenericCsv(csvText)
  if (supplier === 'bidfood') {
    return parseBidfoodFullReportCsv(csvText) ?? parseBidfoodCsv(csvText) ?? parseGenericCsv(csvText)
  }
  if (supplier === 'produceco') return parseProduceCoCsv(csvText) ?? parseGenericCsv(csvText)
  return parseGenericCsv(csvText)
}

// ---------------------------------------------------------------------------
// Pack size written on the end of a product name, which is where both Gilmours
// and Produce Co put it: 'Tatua Sour Cream 12 x 1kg', 'Onion Red Sliced 2.5kg'.
// Only the trailing token is taken, so a measure inside the name ('U-shape
// 250mL rPET Cold Wine Cup with Fill Line 50pk') does not win over the pack.
// ---------------------------------------------------------------------------

const PACK_UNITS =
  'kg|kgs|g|gm|gms|l|lt|ltr|litre|litres|ml|pk|pkt|pkts|pack|packs|pc|pcs|piece|pieces|sheets|ea|each|roll|rolls|bag|bags|tray|trays|tub|tubs|can|cans|bottle|bottles|doz|dozen'

const TRAILING_PACK = new RegExp(
  `\\s+((?:\\d+(?:\\.\\d+)?\\s*[x*]\\s*)?\\d+(?:\\.\\d+)?\\s*(?:${PACK_UNITS})\\.?)$`,
  'i'
)

export function splitTrailingPackSize(name: string): { description: string; packSize?: string } {
  const trimmed = name.trim().replace(/[,;:]+$/, '')
  const match = TRAILING_PACK.exec(trimmed)
  if (!match) return { description: trimmed }
  const description = trimmed.slice(0, match.index).trim()
  // A string that is nothing but a pack size has no name to split off. '12 x
  // 1kg' would otherwise be read as a product called '12 x' — the leftover has
  // to contain an actual word, not just the multiplier.
  if (!/[a-z]{2,}/i.test(description)) return { description: trimmed }
  return { description, packSize: match[1].replace(/\s+/g, '').toLowerCase() }
}

// ---------------------------------------------------------------------------
// Gilmours order confirmations — not a header table but repeated item blocks:
// name / pack / "Product Code: 5137496", then "Quantity 4.0 Each",
// "Price per Each $10.43", "Total $41.72". The same SKU can appear twice with
// different units (Each vs Case); the uom is captured so apply() can pick the
// row matching the catalogue's unit.
//
// Read as whole blocks rather than by pairing a code to the nearest price. The
// pairing version had no way to reach the name or the pack size, so every
// Gilmours line Peter had not bought before became an ingredient called
// 'Gilmours 1090586' with the pack unread — and it silently dropped items
// whose code and price sat more than 400 characters apart.
// ---------------------------------------------------------------------------

/** Label-to-label filler. Bounded so one item's total cannot pair with the next item's code. */
const GAP = '[^$]{0,160}?'

const GILMOURS_BLOCK = new RegExp(
  [
    'Product Code:?\\s*(\\d{4,10})',
    GAP,
    'Quantity\\s*:?\\s*([\\d.]+)\\s*([A-Za-z]+)',
    GAP,
    'Price per\\s+([A-Za-z]+)\\s*:?\\s*\\$\\s*([\\d,]+\\.?\\d*)',
    GAP,
    'Total\\s*:?\\s*\\$\\s*([\\d,]+\\.?\\d*)',
  ].join(''),
  'gi'
)

/**
 * Things that can sit in front of a product name but can never be part of one:
 * the previous item's total, and the headings Gilmours puts above each delivery
 * group. An order split across two deliveries repeats them mid-email, so the
 * first item of every group has a heading stuck to the front of its name.
 */
const GILMOURS_NOT_A_NAME = new RegExp(
  [
    '\\$\\s*[\\d,]+\\.?\\d*',                                                     // previous line total
    'Order part \\d+ of \\d+',
    '\\b\\d+ items\\b',
    // 'Delivery by Gilmours on Tue 8 Sep', 'Delivery of fresh produce by
    // Fresh Connection on Tue 8 Sep'
    'Delivery (?:by|of)[^$]{0,80}?on (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\\s+\\d{1,2}\\s+[A-Za-z]+',
    'Delivery notes',
    'Product requests',
    '\\bn/a\\b',
    '\\bThanks\\b',
  ].join('|'),
  'gi'
)

/**
 * The product name sits in the text before 'Product Code:'. That run also holds
 * everything since the previous item, so it is cut back to whatever came last
 * that cannot belong to a name.
 */
function gilmoursNameFromSegment(segment: string): string {
  let text = segment.replace(/\s+/g, ' ').trim()

  GILMOURS_NOT_A_NAME.lastIndex = 0
  let cut = 0
  let m: RegExpExecArray | null
  while ((m = GILMOURS_NOT_A_NAME.exec(text)) !== null) cut = m.index + m[0].length
  text = text.slice(cut)

  // A delivery note is free text and can end in a full stop mid-segment.
  const lastStop = text.lastIndexOf('. ')
  if (lastStop >= 0) text = text.slice(lastStop + 2)

  // Leading separators only. Gilmours really does sell a '#3 Brown Sugar', so
  // stripping every non-alphanumeric would rename the product.
  return text.replace(/^[\s,;:.|\-–—]+/, '').trim().slice(-90).trim()
}

export function parseGilmoursOrderText(rawText: string): ParseOutcome | null {
  const text = rawText.replace(/\s+/g, ' ')

  const out: ParsedPriceRow[] = []
  const claimed = new Set<string>()
  let prevEnd = 0
  let m: RegExpExecArray | null

  GILMOURS_BLOCK.lastIndex = 0
  while ((m = GILMOURS_BLOCK.exec(text)) !== null) {
    const [, sku, qtyRaw, qtyUom, priceUom, priceRaw, totalRaw] = m
    const qty = parseMoney(qtyRaw)
    const price = parseMoney(priceRaw)
    const total = parseMoney(totalRaw)
    const segment = text.slice(prevEnd, m.index)
    prevEnd = m.index + m[0].length

    if (!isSanePrice(price)) continue
    // qty x price must reproduce the total, or the block spans two items.
    if (Number.isFinite(qty) && Number.isFinite(total) && qty > 0) {
      if (Math.abs(qty * price - total) > Math.max(0.05, total * 0.01)) continue
    }

    const uom = (priceUom || qtyUom || '').toLowerCase()
    const { description, packSize } = splitTrailingPackSize(gilmoursNameFromSegment(segment))
    out.push({
      sku,
      description,
      packSize,
      uom,
      quantity: Number.isFinite(qty) ? qty : undefined,
      price,
    })
    claimed.add(`${sku}:${uom}`)
  }

  // Anything the block reader could not see is still worth its price, so the
  // old code-to-nearest-price pairing runs over the leftovers. It cannot supply
  // a name or a pack, but a priced row beats a dropped one.
  for (const row of pairGilmoursCodesToPrices(text)) {
    if (claimed.has(`${row.sku}:${row.uom ?? ''}`)) continue
    claimed.add(`${row.sku}:${row.uom ?? ''}`)
    out.push(row)
  }

  return out.length ? { parser: 'gilmours-order', rows: out, structured: false } : null
}

function pairGilmoursCodesToPrices(text: string): ParsedPriceRow[] {
  const codeRegex = /Product Code:?\s*([0-9]{4,10})/gi
  const priceRegex = /Price per (Each|Case|Unit|Kg)\s*:?\s*\$?\s*([\d,]+\.?\d*)/gi

  const codes: Array<{ sku: string; pos: number }> = []
  let m: RegExpExecArray | null
  while ((m = codeRegex.exec(text)) !== null) codes.push({ sku: m[1], pos: m.index })

  const prices: Array<{ uom: string; price: number; pos: number; claimed: boolean }> = []
  while ((m = priceRegex.exec(text)) !== null) {
    const price = parseMoney(m[2])
    if (isSanePrice(price)) prices.push({ uom: m[1].toLowerCase(), price, pos: m.index, claimed: false })
  }
  if (!codes.length || !prices.length) return []

  const MAX_DISTANCE = 400
  const out: ParsedPriceRow[] = []
  for (const code of codes) {
    let best: (typeof prices)[number] | null = null
    for (const price of prices) {
      if (price.claimed) continue
      const distance = Math.abs(price.pos - code.pos)
      if (distance > MAX_DISTANCE) continue
      if (!best || distance < Math.abs(best.pos - code.pos)) best = price
    }
    if (!best) continue
    best.claimed = true
    out.push({ sku: code.sku, description: '', uom: best.uom, price: best.price })
  }
  return out
}

// ---------------------------------------------------------------------------
// Produce Co order confirmations. The HTML has the line items in a table, but a
// forwarded copy arrives as plain text where the table has collapsed to one
// line per item:
//
//   2HCHBSL Chicken Breasts Skinless 12kg 2.00 Case $134.00 $268.00
//   BEE Beetroot Red 2.00 Kilo $5.20 $10.40
//
// Code, description, qty, unit, unit price, line total. Pre-ordered items carry
// an extra 'Estimated Delivery Date' line that lands inside the description.
// The price is per the named unit, which is the basis the catalogue stores.
// ---------------------------------------------------------------------------

const PRODUCE_CO_UNITS = 'Case|Kilo|Each|Bag|Box|Punnet|Tray|Unit|Pack|Bunch|Dozen|Sack|Crate|Pail|Pottle|Ctn|Carton|Bundle'

// The code is upper case and always contains a letter ('BEE', '2HCHBSL'). That
// letter is what stops a street number in the delivery address from opening a
// match that then runs the whole table header into the description.
const PRODUCE_CO_LINE = new RegExp(
  [
    '\\b([0-9]*[A-Z][A-Z0-9]{1,19})\\s+',            // supplier code
    '([A-Za-z][^$*:]{0,80}?)\\s+',                   // description, never crossing a header cell
    '(\\d+(?:\\.\\d+)?)\\s+',                        // qty
    `(${PRODUCE_CO_UNITS})\\s+`,                     // unit the price is per
    '\\$\\s*([\\d,]+\\.?\\d*)\\s+',                  // unit price
    '\\$\\s*([\\d,]+\\.?\\d*)',                      // line total
  ].join(''),
  'g'
)

export function parseProduceCoOrderText(rawText: string): ParseOutcome | null {
  const text = rawText.replace(/\s+/g, ' ')
  if (!/Items in Your Order|Order Numbers?:|produce\.co\.nz/i.test(text)) return null

  const out: ParsedPriceRow[] = []
  PRODUCE_CO_LINE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = PRODUCE_CO_LINE.exec(text)) !== null) {
    const [, sku, rawDescription, qtyRaw, unit, priceRaw, totalRaw] = m
    const qty = parseMoney(qtyRaw)
    const price = parseMoney(priceRaw)
    const total = parseMoney(totalRaw)
    if (!isSanePrice(price) || !Number.isFinite(qty) || qty <= 0) continue
    // qty x price must reproduce the line total, or the columns were misread.
    if (Number.isFinite(total) && Math.abs(qty * price - total) > Math.max(0.05, total * 0.01)) continue

    const cleaned = rawDescription
      .replace(/Estimated Delivery Date\s*\d{1,2}\/\d{1,2}\/\d{2,4}/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) continue

    const { description, packSize } = splitTrailingPackSize(cleaned)
    out.push({ sku, description, packSize, uom: unit.toLowerCase(), quantity: qty, price })
  }

  return out.length ? { parser: 'produceco-order', rows: out, structured: false } : null
}

// ---------------------------------------------------------------------------
// Bidfood invoice emails ("Your order is now Invoiced") — one line per item:
//   108917 Muffin English Splits [36PC/Carton]  3.00  $20.96  $62.88
//   (code, description, [packSize/UOM], qty, price, line subtotal)
//
// The price is per the bracketed UOM. When that UOM is a carton and the pack
// size leads with a multiplier (e.g. 15X1KG → $264.81/carton), the catalogue
// stores the per-inner price, so the price is divided by the multiplier
// (264.81 ÷ 15 = 17.65 — verified against live data). Per-Packet/Tub/Kilo
// lines are already on the catalogue's basis and pass through unchanged.
// ---------------------------------------------------------------------------

export function parseBidfoodInvoiceText(rawText: string): ParseOutcome | null {
  const text = rawText.replace(/\s+/g, ' ')
  if (!/invoiced|shipment|products/i.test(text)) return null

  const bracketRegex = /\[([^\]/]+)\/([^\]]+)\]/g
  const out: ParsedPriceRow[] = []
  let prevEnd = 0
  let m: RegExpExecArray | null

  while ((m = bracketRegex.exec(text)) !== null) {
    const packSize = m[1].trim()
    const uom = m[2].trim()

    // Backwards from '[': the last "code description" run in this segment.
    const segment = text.slice(prevEnd, m.index)
    const head = /(\d{4,7})\s+([A-Za-z][^[]*?)\s*$/.exec(segment)

    // Forwards from ']': qty, unit price, line subtotal.
    const tail = /^\s*([\d.,]+)\s*\$\s*([\d.,]+)\s*\$\s*([\d.,]+)/.exec(text.slice(m.index + m[0].length))
    prevEnd = m.index + m[0].length

    if (!head || !tail) continue
    const qty = parseMoney(tail[1])
    let price = parseMoney(tail[2])
    const lineTotal = parseMoney(tail[3])
    if (!isSanePrice(price) || !Number.isFinite(qty) || qty <= 0) continue

    // qty × price must reproduce the line total, or the numbers were misread.
    if (Number.isFinite(lineTotal) && Math.abs(qty * price - lineTotal) > Math.max(0.05, lineTotal * 0.01)) continue

    // Carton-priced line with a pack multiplier → convert to per-inner.
    const multiplier = /^(\d+)\s*X/i.exec(packSize)
    if (/^(carton|case|ctn)$/i.test(uom) && multiplier && Number(multiplier[1]) > 1) {
      price = Math.round((price / Number(multiplier[1])) * 100) / 100
    }

    out.push({ sku: head[1], description: head[2].trim(), packSize, uom, price })
  }
  return out.length ? { parser: 'bidfood-invoice', rows: out, structured: false } : null
}

// ---------------------------------------------------------------------------
// HTML table extraction — for order-confirmation bodies with a line-item table.
// Regex-based on purpose: no DOM dependency, and a malformed table simply
// yields nothing rather than throwing.
// ---------------------------------------------------------------------------

const decodeEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const stripTags = (value: string): string => decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

function extractTables(html: string): string[][][] {
  const tables: string[][][] = []
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  for (const tableHtml of tableMatches.slice(0, 20)) {
    const rows: string[][] = []
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
    for (const rowHtml of rowMatches.slice(0, MAX_ROWS_PER_INGESTION + 1)) {
      const cells: string[] = []
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let match: RegExpExecArray | null
      while ((match = cellRegex.exec(rowHtml)) !== null) cells.push(stripTags(match[1]))
      if (cells.length) rows.push(cells)
    }
    if (rows.length >= 2) tables.push(rows)
  }
  return tables
}

/**
 * Finds the first HTML table that looks like supplier line items: a header row
 * naming a price column plus a code or description column.
 */
export function parseHtmlTables(html: string): ParseOutcome | null {
  for (const rows of extractTables(html)) {
    const headers = rows[0].map((h) => h.toLowerCase())
    // "Price (excl GST)" is a unit price; only a "total" marker disqualifies.
    const priceIdx = headers.findIndex((h) => /price|rate/.test(h) && !/total/.test(h))
    const totalPriceIdx = headers.findIndex((h) => /price|amount|total/.test(h))
    const codeIdx = headers.findIndex((h) => /sku|code|item no|product no/.test(h))
    const descIdx = headers.findIndex((h) => /desc|product|item|name/.test(h) && !/no\.?$|number/.test(h))
    const qtyIdx = headers.findIndex((h) => /qty|quantity|units?\b/.test(h))

    const effectivePriceIdx = priceIdx >= 0 ? priceIdx : totalPriceIdx
    if (effectivePriceIdx < 0 || (codeIdx < 0 && descIdx < 0)) continue

    const out: ParsedPriceRow[] = []
    for (const row of rows.slice(1)) {
      const sku = codeIdx >= 0 ? cleanCell(row[codeIdx]) : ''
      const description = descIdx >= 0 ? cleanCell(row[descIdx]) : ''
      const price = parseMoney(row[effectivePriceIdx])
      if ((!sku && !description) || !isSanePrice(price)) continue
      // Skip obvious footer rows (subtotal / freight / GST).
      if (/subtotal|total|freight|delivery|gst|rounding/i.test(`${sku} ${description}`)) continue
      out.push({
        sku: sku || null,
        description,
        quantity: qtyIdx >= 0 ? parseIntSafe(row[qtyIdx]) || undefined : undefined,
        price,
      })
    }
    if (out.length) return { parser: 'html-table', rows: out, structured: false }
  }
  return null
}
