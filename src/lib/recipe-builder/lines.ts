// Addressing a single row of a stored recipe array.
//
// A costed owner's lines are several arrays concatenated: the product's
// `baseIngredients`, the rows the variant title's options contribute, the pack
// contents, then whatever legacy rows the variant still carries — and rows an
// option or pack already supplies are dropped from the last group. The rendered
// list is therefore not any one of the stored arrays, and a row's position in
// it is not a position in anything that can be written to.
//
// So a line is addressed by `(origin, position)`: which stored array it came
// from, and its index in that array exactly as stored. `parseRecipeLines`
// stamps both when it reads the JSON, which makes the pair survive
// concatenation, de-duplication, expansion of nested components and rows that
// reference the same ingredient twice.

/** The stored array a row came from. Mirrors `RecipeLine['origin']`. */
export type LineOrigin = 'base' | 'option' | 'bundle' | 'variant' | 'component'

export interface LineTarget {
  origin: LineOrigin
  /** Index in the stored array, including rows the parser skips. */
  position: number
  /** The row's ref as the page saw it, so an array that has moved underneath a
   *  stale tab is refused rather than silently editing the wrong line. */
  refId: string
}

export type RecipeRow = Record<string, unknown>

/**
 * Origins that name an array this endpoint can write to.
 *
 * `option` rows are derived from the CostingOption catalogue and `bundle` rows
 * from pack contents; neither is stored on the owner, so neither can be edited
 * here without editing something else entirely.
 */
export const EDITABLE_ORIGINS: readonly LineOrigin[] = ['base', 'variant', 'component']

export function isEditableOrigin(origin: LineOrigin): boolean {
  return EDITABLE_ORIGINS.includes(origin)
}

export function notEditableReason(origin: LineOrigin): string {
  if (origin === 'option') {
    return 'This line comes from a choice in the product title, not from the recipe. Edit it in the costing options.'
  }
  if (origin === 'bundle') {
    return 'This line is an item inside a party pack. Open that product to change its recipe, or edit the pack contents.'
  }
  return `Lines of kind '${origin}' cannot be edited here.`
}

/**
 * The stored array, with every index preserved.
 *
 * Rows are deliberately not filtered: `parseRecipeLines` counts positions over
 * the raw array, so dropping an unusable row here would shift every position
 * after it and address the wrong line.
 */
export function readRecipeRows(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : []
}

/** The ref the tree exposes for a row — same fallbacks as `parseRecipeLines`. */
export function rowRefId(row: unknown): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return ''
  const r = row as RecipeRow
  return String(r.id ?? r.sku ?? r.productCode ?? r.code ?? '').trim()
}

export type LocateResult =
  | { ok: true; index: number; row: RecipeRow }
  | { ok: false; status: number; error: string }

/** Resolves one target against the array its origin names. */
export function locateRow(rows: unknown[], target: LineTarget): LocateResult {
  if (!Number.isInteger(target.position) || target.position < 0 || target.position >= rows.length) {
    return {
      ok: false,
      status: 409,
      error: `That line is no longer at position ${target.position} of ${rows.length} — refresh and try again.`,
    }
  }
  const row = rows[target.position]
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, status: 409, error: 'That line is not a recipe row — refresh and try again.' }
  }
  const actual = rowRefId(row)
  if (target.refId && actual !== target.refId) {
    return {
      ok: false,
      status: 409,
      error: `That line now reads "${String((row as RecipeRow).name ?? actual)}" — the recipe changed since the page loaded. Refresh and try again.`,
    }
  }
  return { ok: true, index: target.position, row: row as RecipeRow }
}

/** Resolves several targets that must all address the same array. */
export function locateRows(
  rows: unknown[],
  targets: LineTarget[]
): { ok: true; indexes: number[]; rows: RecipeRow[] } | { ok: false; status: number; error: string } {
  const seen = new Set<number>()
  const indexes: number[] = []
  const found: RecipeRow[] = []
  for (const target of targets) {
    const located = locateRow(rows, target)
    if (!located.ok) return located
    if (seen.has(located.index)) continue
    seen.add(located.index)
    indexes.push(located.index)
    found.push(located.row)
  }
  return { ok: true, indexes, rows: found }
}

export function removeRow(rows: unknown[], index: number): unknown[] {
  return rows.filter((_, i) => i !== index)
}

export function removeRows(rows: unknown[], indexes: number[]): unknown[] {
  const drop = new Set(indexes)
  return rows.filter((_, i) => !drop.has(i))
}

export function patchRow(rows: unknown[], index: number, patch: RecipeRow): unknown[] {
  return rows.map((row, i) => (i === index ? { ...(row as RecipeRow), ...patch } : row))
}

export function replaceRow(rows: unknown[], index: number, row: RecipeRow): unknown[] {
  return rows.map((existing, i) => (i === index ? row : existing))
}
