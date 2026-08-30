// Costing a variant from the choices in its title.
//
// A variant title is a ' / '-separated list of the choices the customer made:
// "No serveware / Chicken (DF) / Beef Brisket (DF)(GF)(H)". Cost used to be a
// flat bag of rows stored on each of ~1,300 variants and kept in sync by
// substring-matching rules, which is why a beef platter ended up carrying
// chicken rows and no beef at all.
//
// The same ~99 choices underlie the whole catalogue, so each is costed once as
// a CostingOption and a variant is simply:
//
//     product base recipe  +  Σ (option recipe × portions for that product)
//
// Nothing fans out, so nothing can drift. This module is pure — the database
// side lives in ./load.

import { splitParts } from '@/lib/variant-part-edit'

/** One row of a recipe, as stored in every `ingredients` JSON array. */
export interface RecipeRow {
  source: string
  id: string
  name: string
  quantity: number
  cost: number
  unit: string
  ingredientId?: string | null
}

/**
 * Identity of a recipe row: the catalogue item it points at, ignoring
 * quantity. Two rows with the same key are the same ingredient.
 */
export function rowKey(row: { source?: unknown; id?: unknown; name?: unknown }): string {
  const source = String(row?.source ?? '').trim().toLowerCase()
  const id = String(row?.id ?? '').trim().toLowerCase()
  if (id) return `${source}:${id}`
  // Legacy rows written before ids were captured can only be matched by name.
  return `${source}:name:${String(row?.name ?? '').trim().toLowerCase()}`
}

export function normalizeRow(raw: any): RecipeRow | null {
  if (!raw || typeof raw !== 'object') return null
  const source = String(raw.source ?? '').trim()
  const id = String(raw.id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  if (!source || (!id && !name)) return null
  const quantity = Number(raw.quantity)
  const cost = Number(raw.cost)
  return {
    source,
    id,
    name: name || id,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
    unit: String(raw.unit ?? 'unit').trim() || 'unit',
    ...(raw.ingredientId ? { ingredientId: String(raw.ingredientId) } : {}),
  }
}

export function normalizeRows(raw: unknown): RecipeRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeRow).filter((r): r is RecipeRow => r !== null)
}

/**
 * Loose key used to group spellings of the same thing and to suggest matches
 * against the component list. Dietary and cooking qualifiers are dropped
 * because they distinguish menu copy, not ingredients: "Beef Brisket (GF DF
 * Halal)" and "Beef brisket (DF) (GF) (H)" are one option.
 */
export function normalizeOptionKey(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/[^a-z0-9$]+/g, ' ')
    .replace(/\b(gf|df|h|halal|v|vegan|baked|fried)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Alias lookups ignore case and stray whitespace; Shopify is inconsistent about both. */
export function aliasKey(value: string): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface CostingOptionRecord {
  id: string
  name: string
  kind: string
  items: RecipeRow[]
  noIngredients: boolean
}

export interface OptionIndex {
  /** `aliasKey(value)` -> option. */
  byAlias: Map<string, CostingOptionRecord>
  byId: Map<string, CostingOptionRecord>
  /** `${productId}:${optionId}` -> explicit portion count for that product. */
  quantities: Map<string, number>
  /** productId -> default portions when there is no explicit quantity. */
  portionSize: Map<string, number>
}

export function emptyOptionIndex(): OptionIndex {
  return { byAlias: new Map(), byId: new Map(), quantities: new Map(), portionSize: new Map() }
}

export interface VariantOptionResult {
  /** Summed rows contributed by every option in the title. */
  rows: RecipeRow[]
  /** Options recognised in the title, in order. */
  matched: CostingOptionRecord[]
  /** Title segments with no option behind them — the triage queue. */
  unmatched: string[]
  /** Matched options that are deliberately free of ingredients. */
  freeOfCharge: CostingOptionRecord[]
  /** Matched options still awaiting a recipe. */
  uncosted: CostingOptionRecord[]
}

export function portionsFor(index: OptionIndex, productId: string, optionId: string): number {
  const explicit = index.quantities.get(`${productId}:${optionId}`)
  if (explicit != null && Number.isFinite(explicit)) return explicit
  const size = index.portionSize.get(productId)
  return size != null && Number.isFinite(size) ? size : 1
}

/**
 * Resolves a variant title into the recipe rows its choices contribute.
 *
 * A title can legitimately name the same option twice ("Beef Brisket (GF DF) /
 * Beef Brisket (GF DF Halal)" is two beef portions), so quantities accumulate
 * rather than deduplicate.
 */
export function optionRowsForVariant(
  shopifyName: string,
  productId: string,
  index: OptionIndex
): VariantOptionResult {
  const matched: CostingOptionRecord[] = []
  const unmatched: string[] = []
  const freeOfCharge: CostingOptionRecord[] = []
  const uncosted: CostingOptionRecord[] = []
  const acc = new Map<string, RecipeRow>()

  for (const part of splitParts(shopifyName)) {
    const option = index.byAlias.get(aliasKey(part))
    if (!option) {
      unmatched.push(part)
      continue
    }
    matched.push(option)
    if (option.noIngredients) {
      freeOfCharge.push(option)
      continue
    }
    if (option.items.length === 0) {
      uncosted.push(option)
      continue
    }

    const portions = portionsFor(index, productId, option.id)
    if (!(portions > 0)) continue

    for (const item of option.items) {
      const key = rowKey(item)
      const existing = acc.get(key)
      const quantity = item.quantity * portions
      if (existing) existing.quantity += quantity
      else acc.set(key, { ...item, quantity })
    }
  }

  return { rows: Array.from(acc.values()), matched, unmatched, freeOfCharge, uncosted }
}

/**
 * Legacy per-variant rows that the options have not taken over.
 *
 * During migration a variant still carries the rows the old rules sprayed onto
 * it. Anything an option now supplies must be dropped here or it would be
 * counted twice; anything else is kept so no cost silently disappears.
 */
export function residualLegacyRows(legacy: RecipeRow[], optionRows: RecipeRow[]): RecipeRow[] {
  if (optionRows.length === 0) return legacy
  const supplied = new Set(optionRows.map(rowKey))
  return legacy.filter((row) => !supplied.has(rowKey(row)))
}
