// Canonical unit handling for the pricing engine.
//
// Replaces the five divergent `toBase` copies (ComponentsTab.tsx:849 and :1137,
// api/components/route.ts:36, api/components/[id]/route.ts:49, and
// pricing-lab/page.tsx:245). Those all collapse an unrecognised unit to a
// dimensionless count and happily divide mass by volume; here a kind mismatch
// is `null` so the caller can report the gap instead of producing a number
// that looks plausible and is wrong by a factor of 1000.

export type UnitKind = 'mass' | 'volume' | 'count'

/** What the engine costs in. Legacy columns spell 'each' as 'unit'. */
export type CanonicalUnit = 'kg' | 'l' | 'each'

/** The spelling used by `Component.normalizedOutputUnit` and existing readers. */
export type LegacyOutputUnit = 'kg' | 'l' | 'unit'

const MASS_TO_KG: Record<string, number> = {
  kg: 1,
  kgs: 1,
  kilo: 1,
  kilos: 1,
  kilogram: 1,
  kilograms: 1,
  kilogramme: 1,
  kilogrammes: 1,
  g: 0.001,
  gm: 0.001,
  gms: 0.001,
  gr: 0.001,
  grm: 0.001,
  gram: 0.001,
  grams: 0.001,
  gramme: 0.001,
  grammes: 0.001,
  mg: 0.000001,
  milligram: 0.000001,
  milligrams: 0.000001,
}

const VOLUME_TO_L: Record<string, number> = {
  l: 1,
  lt: 1,
  lts: 1,
  ltr: 1,
  ltrs: 1,
  litre: 1,
  litres: 1,
  liter: 1,
  liters: 1,
  ml: 0.001,
  mls: 0.001,
  millilitre: 0.001,
  millilitres: 0.001,
  milliliter: 0.001,
  milliliters: 0.001,
  cl: 0.01,
  dl: 0.1,
}

// Everything here is one countable thing. Container words (ctn, case, tray) are
// included because supplier UOM columns use them as the thing being priced;
// pack *structure* is parsed separately in packsize.ts.
const COUNT_UNITS = new Set([
  'each', 'ea', 'eaches',
  'unit', 'units', 'un',
  'pc', 'pcs', 'piece', 'pieces',
  'pk', 'pkt', 'pkts', 'pack', 'packs', 'packet', 'packets',
  'bag', 'bags',
  'bottle', 'bottles', 'btl',
  'jar', 'jars',
  'tin', 'tins', 'can', 'cans',
  'punnet', 'punnets',
  'tub', 'tubs',
  'tray', 'trays',
  'box', 'boxes',
  'ctn', 'ctns', 'carton', 'cartons',
  'case', 'cases',
  'sleeve', 'sleeves',
  'bunch', 'bunches',
  'head', 'heads',
  'portion', 'portions',
  'serve', 'serves', 'serving', 'servings',
  'slice', 'slices',
  'sheet', 'sheets',
  'roll', 'rolls',
  'item', 'items',
])

/** Lower-cases, trims, and drops trailing punctuation so 'KG.' matches 'kg'. */
export function normalizeUnitToken(unit: string | null | undefined): string {
  return String(unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.\s]+$/, '')
}

export function unitKind(unit: string | null | undefined): UnitKind | null {
  const token = normalizeUnitToken(unit)
  if (!token) return null
  if (token in MASS_TO_KG) return 'mass'
  if (token in VOLUME_TO_L) return 'volume'
  if (COUNT_UNITS.has(token)) return 'count'
  return null
}

export function canonicalForKind(kind: UnitKind): CanonicalUnit {
  if (kind === 'mass') return 'kg'
  if (kind === 'volume') return 'l'
  return 'each'
}

/** The canonical unit a given unit string belongs to, or null if unrecognised. */
export function canonicalFor(unit: string | null | undefined): CanonicalUnit | null {
  const kind = unitKind(unit)
  return kind ? canonicalForKind(kind) : null
}

/** How many canonical units one of `unit` is worth (1 g -> 0.001 kg). */
function canonicalFactor(unit: string | null | undefined): { factor: number; unit: CanonicalUnit } | null {
  const token = normalizeUnitToken(unit)
  if (!token) return null
  if (token in MASS_TO_KG) return { factor: MASS_TO_KG[token], unit: 'kg' }
  if (token in VOLUME_TO_L) return { factor: VOLUME_TO_L[token], unit: 'l' }
  if (COUNT_UNITS.has(token)) return { factor: 1, unit: 'each' }
  return null
}

export function toCanonical(qty: number, unit: string | null | undefined): { qty: number; unit: CanonicalUnit } | null {
  if (!Number.isFinite(qty)) return null
  const resolved = canonicalFactor(unit)
  if (!resolved) return null
  return { qty: qty * resolved.factor, unit: resolved.unit }
}

// Legacy-parity variant: an unrecognised unit becomes a bare count, exactly as
// the old `toBase` helpers did. Only for values the old code already treated
// this way (Component.producedUnit), never for ingredient line units — those
// should surface as unknown rather than silently become a count.
export function toCanonicalLoose(qty: number, unit: string | null | undefined): { qty: number; unit: CanonicalUnit } {
  return toCanonical(qty, unit) ?? { qty, unit: 'each' }
}

/** Returns null across kinds rather than dividing mass by volume. */
export function convert(qty: number, from: string | null | undefined, to: string | null | undefined): number | null {
  if (!Number.isFinite(qty)) return null
  const a = canonicalFactor(from)
  const b = canonicalFactor(to)
  if (!a || !b) return null
  if (a.unit !== b.unit) return null
  return (qty * a.factor) / b.factor
}

export function toLegacyOutputUnit(unit: CanonicalUnit): LegacyOutputUnit {
  return unit === 'each' ? 'unit' : unit
}

export function fromLegacyOutputUnit(unit: string | null | undefined): CanonicalUnit {
  const token = normalizeUnitToken(unit)
  if (token === 'kg') return 'kg'
  if (token === 'l') return 'l'
  return 'each'
}

export function isCountUnit(unit: string | null | undefined): boolean {
  return unitKind(unit) === 'count'
}
