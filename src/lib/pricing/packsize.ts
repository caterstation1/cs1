// Supplier pack-size parsing and per-canonical-unit pricing.
//
// The engine's copy of what `src/lib/packsize.ts` does today, with three
// changes the old one can't make without altering IngredientSelector's stored
// costs: the parsed structure is always returned (not just the derived price),
// `confidence` is always present and meaningful rather than discarded by the
// caller, and pack structure can be derived without a price (the backfill and
// email ingestion need that in later phases).
//
// The old module is deliberately left untouched in this phase; it is retired
// in favour of this one during Phase 4 cleanup.

import {
  CanonicalUnit,
  canonicalFor,
  convert,
  normalizeUnitToken,
  unitKind,
} from './units'

export interface ParsedPackSize {
  /** Pieces in the pack: the 4 in '4x3kg'. */
  unitsPerPack: number
  /** Size of one piece: the 3 in '4x3kg'. */
  sizePerUnit: number
  /** Unit `sizePerUnit` is expressed in, as written ('kg', 'g', 'ml', 'each'). */
  sizeUnit: string
  canonicalUnit: CanonicalUnit
  /** `sizePerUnit` in `canonicalUnit`. */
  canonicalSizePerUnit: number
  /** The whole pack in `canonicalUnit` (7.5 for a 3 x 2.5kg case). */
  totalCanonicalQty: number
  confidence: number
  notes: string[]
  raw: string
}

export interface PackStructure extends ParsedPackSize {
  /** UOM says the price is already per kg/l, so pack structure doesn't divide it. */
  weightPriced: boolean
  /** Whether the supplier's price covers the whole pack or a single piece. */
  pricedPer: 'pack' | 'piece' | 'canonical'
  uom: string | null
  ctnQty: number | null
}

export interface DerivedUnitPricing {
  unitCost: number
  unit: CanonicalUnit
  confidence: number
  basis: 'weight-priced' | 'per-pack' | 'per-piece'
  structure: PackStructure
}

// Matching the old module: only these UOMs mean "this price is for the whole
// carton". Everything else is treated as a per-piece price.
const CASE_UOMS = new Set(['case', 'cases', 'carton', 'cartons', 'ctn', 'ctns', 'tray', 'trays', 'sleeve', 'sleeves'])

const CONFIDENCE = {
  multiplierAndMeasure: 0.95,
  measureOnly: 0.9,
  weightPriced: 0.9,
  ctnQtyAgrees: 0.95,
  countWithNumber: 0.6,
  bareUnitToken: 0.5,
  ctnQtyOnly: 0.55,
  unparseable: 0.2,
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return NaN
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : NaN
}

function unparseable(raw: string, notes: string[]): ParsedPackSize {
  return {
    unitsPerPack: 1,
    sizePerUnit: 1,
    sizeUnit: 'each',
    canonicalUnit: 'each',
    canonicalSizePerUnit: 1,
    totalCanonicalQty: 1,
    confidence: CONFIDENCE.unparseable,
    notes,
    raw,
  }
}

function build(
  raw: string,
  unitsPerPack: number,
  sizePerUnit: number,
  sizeUnit: string,
  confidence: number,
  notes: string[]
): ParsedPackSize {
  const canonicalUnit = canonicalFor(sizeUnit) ?? 'each'
  const canonicalSizePerUnit = convert(sizePerUnit, sizeUnit, canonicalUnit) ?? sizePerUnit
  return {
    unitsPerPack,
    sizePerUnit,
    sizeUnit,
    canonicalUnit,
    canonicalSizePerUnit,
    totalCanonicalQty: unitsPerPack * canonicalSizePerUnit,
    confidence,
    notes,
    raw,
  }
}

/**
 * Parses '4x3kg', '12x500g', '24x330ml', '2.5kg', '10 × 250g', '6', 'each',
 * bare 'kg'. Never returns null for a non-empty string: an unrecognised pack
 * comes back as 1 x 1 each with confidence 0.2 so callers can filter on
 * confidence rather than on null.
 */
export function parsePackSize(packSizeRaw?: string | null): ParsedPackSize | null {
  const raw = String(packSizeRaw ?? '').trim()
  if (!raw) return null

  const notes: string[] = []
  // Unify the multiplier glyphs suppliers use: 4x3kg / 4 × 3kg / 4*3kg.
  let rest = raw.toLowerCase().replace(/[×✕✖]/g, 'x').replace(/\s+/g, ' ')

  const multipliers: number[] = []
  const multiplierRe = /^\s*(\d+(?:[.,]\d+)?)\s*[x*]\s*/
  let match = rest.match(multiplierRe)
  while (match) {
    const value = toNumber(match[1])
    if (!Number.isFinite(value) || value <= 0) break
    multipliers.push(value)
    rest = rest.slice(match[0].length)
    match = rest.match(multiplierRe)
  }

  const unitsPerPack = multipliers.length ? multipliers.reduce((a, b) => a * b, 1) : 1
  if (multipliers.length > 1) notes.push(`nested multipliers ${multipliers.join('x')}`)

  const amountMatch = rest.match(/^\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)?/)
  if (amountMatch) {
    const amount = toNumber(amountMatch[1])
    const rawUnit = amountMatch[2] ? normalizeUnitToken(amountMatch[2]) : ''
    if (!Number.isFinite(amount) || amount <= 0) {
      return unparseable(raw, ['non-positive amount'])
    }

    const kind = rawUnit ? unitKind(rawUnit) : null
    if (kind === 'mass' || kind === 'volume') {
      const confidence = multipliers.length ? CONFIDENCE.multiplierAndMeasure : CONFIDENCE.measureOnly
      return build(raw, unitsPerPack, amount, rawUnit, confidence, notes)
    }

    if (rawUnit && kind === null) notes.push(`unrecognised unit '${rawUnit}'`)
    // '24', '24pc', '6 bags' — the number counts pieces, not a measure.
    notes.push('counted as pieces')
    return build(
      raw,
      unitsPerPack * amount,
      1,
      'each',
      rawUnit && kind === null ? CONFIDENCE.unparseable : CONFIDENCE.countWithNumber,
      notes
    )
  }

  // No leading number: a bare unit such as 'kg' (weight-priced) or 'each'.
  const bareUnit = normalizeUnitToken(rest)
  const bareKind = unitKind(bareUnit)
  if (bareKind) {
    notes.push(`bare unit '${bareUnit}'`)
    return build(raw, unitsPerPack, 1, bareUnit, CONFIDENCE.bareUnitToken, notes)
  }

  return unparseable(raw, [`could not parse '${raw}'`])
}

export interface PackStructureOptions {
  /**
   * The supplier's UOM names the whole listed pack, not one piece inside it.
   *
   * True for Gilmours, whose only units are Each, Case and KG, and whose pack
   * size column always describes one sellable unit: '40 x 90g' at 'Price per
   * Each $64.88' is $64.88 for the box of forty, not for one 90g bagel.
   *
   * False for Bidfood, whose UOM names the piece: '[12X400G/Tin]' at $4.02 is
   * $4.02 for one 400g tin. Reading that as the whole carton would price tomato
   * paste at 84c/kg instead of $10.05/kg.
   */
  unitNamesPack?: boolean
}

/**
 * Which suppliers price per listed pack. Keep every caller reading this rather
 * than testing the source name themselves, so the ingredient search, the recipe
 * picker and the costing engine can never disagree about what a price means.
 */
export function unitNamesPackFor(source: string | null | undefined): boolean {
  const normalized = String(source ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return normalized === 'gilmours' || normalized === 'produceco' || normalized === 'producecompany'
}

/**
 * Pack structure with the supplier's UOM and carton quantity folded in.
 * Bidfood supplies ctnQty alongside packSize; Gilmours supplies packSize+uom.
 */
export function parsePackStructure(
  packSize?: string | null,
  uom?: string | null,
  ctnQty?: number | string | null,
  options: PackStructureOptions = {}
): PackStructure {
  const uomToken = normalizeUnitToken(uom) || null
  const uomKind = uomToken ? unitKind(uomToken) : null
  const weightPriced = uomKind === 'mass' || uomKind === 'volume'

  const ctnQtyValue = ctnQty == null || ctnQty === '' ? null : toNumber(ctnQty)
  const ctn = ctnQtyValue != null && Number.isFinite(ctnQtyValue) && ctnQtyValue > 0 ? ctnQtyValue : null

  let parsed = parsePackSize(packSize)
  const notes = parsed ? [...parsed.notes] : []

  if (!parsed) {
    if (ctn) {
      notes.push('pack size absent; used ctnQty')
      parsed = build('', ctn, 1, 'each', CONFIDENCE.ctnQtyOnly, notes)
    } else if (weightPriced && uomToken) {
      notes.push(`pack size absent; priced per ${uomToken}`)
      parsed = build('', 1, 1, uomToken, CONFIDENCE.weightPriced, notes)
    } else {
      parsed = unparseable('', ['no pack size, uom, or ctnQty'])
      notes.push(...parsed.notes)
    }
  }

  let confidence = parsed.confidence
  let unitsPerPack = parsed.unitsPerPack

  if (ctn != null && parsed.canonicalUnit !== 'each') {
    if (Math.abs(ctn - parsed.unitsPerPack) < 1e-9) {
      confidence = Math.max(confidence, CONFIDENCE.ctnQtyAgrees)
    } else {
      notes.push(`ctnQty ${ctn} disagrees with pack size ${parsed.unitsPerPack}`)
      confidence = Math.min(confidence, 0.5)
    }
  } else if (ctn != null && parsed.canonicalUnit === 'each' && parsed.unitsPerPack === 1) {
    // Pack size gave no count but the carton quantity does.
    unitsPerPack = ctn
    notes.push(`pieces from ctnQty ${ctn}`)
    confidence = Math.max(confidence, CONFIDENCE.ctnQtyOnly)
  }

  const isCase = uomToken ? CASE_UOMS.has(uomToken) : false
  const coversWholePack = isCase || Boolean(options.unitNamesPack)
  const pricedPer: PackStructure['pricedPer'] = weightPriced ? 'canonical' : coversWholePack ? 'pack' : 'piece'

  if (weightPriced) confidence = Math.max(confidence, CONFIDENCE.weightPriced)

  // '6X670G' with UOM 'Can': the pack says six pieces but the UOM names one,
  // so the price could be per can or per carton — a factor-of-six difference.
  // Reading it per piece keeps parity with the existing behaviour, but the
  // confidence has to say it is a guess. Not ambiguous when the supplier's unit
  // is known to name the pack.
  if (!weightPriced && !coversWholePack && unitsPerPack > 1 && parsed.canonicalUnit !== 'each') {
    notes.push(`price basis ambiguous: pack holds ${unitsPerPack} pieces but UOM is '${uomToken ?? 'unset'}'`)
    confidence = Math.min(confidence, 0.5)
  }

  const canonicalUnit = weightPriced && uomToken ? canonicalFor(uomToken) ?? parsed.canonicalUnit : parsed.canonicalUnit

  return {
    ...parsed,
    unitsPerPack,
    totalCanonicalQty: unitsPerPack * parsed.canonicalSizePerUnit,
    canonicalUnit,
    confidence,
    notes,
    weightPriced,
    pricedPer,
    uom: uomToken,
    ctnQty: ctn,
  }
}

/**
 * Supplier price -> cost per canonical unit.
 *
 * The $10 carton of 3 x 2.5kg: structure is 3 pieces of 2.5kg = 7.5kg, and a
 * case UOM means the $10 covers the lot, so $1.3333/kg. The same pack with a
 * per-piece UOM means $10 buys one 2.5kg piece, so $4.00/kg.
 */
export function deriveUnitPricing(
  opts: {
    packSize?: string | null
    uom?: string | null
    ctnQty?: number | string | null
    price?: number | string | null
  } & PackStructureOptions
): DerivedUnitPricing | null {
  const price = toNumber(opts.price)
  if (!Number.isFinite(price)) return null

  const structure = parsePackStructure(opts.packSize, opts.uom, opts.ctnQty, {
    unitNamesPack: opts.unitNamesPack,
  })

  if (structure.weightPriced && structure.uom) {
    // Price is per uom already; restate it per canonical unit (per g -> per kg).
    const perCanonical = convert(1, structure.uom, structure.canonicalUnit)
    if (!perCanonical || perCanonical <= 0) return null
    return {
      unitCost: price / perCanonical,
      unit: structure.canonicalUnit,
      confidence: structure.confidence,
      basis: 'weight-priced',
      structure,
    }
  }

  if (structure.canonicalUnit === 'each') {
    const divisor = structure.pricedPer === 'pack' ? structure.unitsPerPack : 1
    if (!(divisor > 0)) return null
    return {
      unitCost: price / divisor,
      unit: 'each',
      confidence: structure.confidence,
      basis: structure.pricedPer === 'pack' ? 'per-pack' : 'per-piece',
      structure,
    }
  }

  const divisor = structure.pricedPer === 'pack' ? structure.totalCanonicalQty : structure.canonicalSizePerUnit
  if (!(divisor > 0)) return null
  return {
    unitCost: price / divisor,
    unit: structure.canonicalUnit,
    confidence: structure.confidence,
    basis: structure.pricedPer === 'pack' ? 'per-pack' : 'per-piece',
    structure,
  }
}
