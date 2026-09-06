// Operator price sheets: what a city operator actually pays, applied as an
// overlay on top of the shared cost index.
//
// The whole design rests on one property of `buildCostIndex`: the index is a
// per-request object, and every catalogue-sourced recipe line reads its price
// from `CatalogueEntry.cost`. Replacing that value before costing therefore
// reprices every recipe, component and party pack that touches the ingredient,
// through exactly the same code path production costing uses — while writing
// nothing back to the database. `Component.totalCost`, `ProductVariant.totalCost`,
// `PricePoint`, `CostOverride` and the COGS locks are all untouched.

import { prisma as defaultPrisma } from '../prisma'
import {
  BuildCostIndexOptions,
  CatalogueEntry,
  CatalogueSource,
  CostIndex,
  RecipeLine,
  buildCostIndex,
  catalogueKey,
  isCatalogueSource,
  normalizeSource,
} from './resolve'
import { CanonicalUnit } from './units'
import { deriveSheetUnitCost } from './sheet-math'

export { deriveSheetUnitCost } from './sheet-math'
export type { DerivedSheetCost } from './sheet-math'

/** A `PriceSheetEntry` row, structurally — so tests need no database. */
export interface SheetEntryInput {
  source: string
  sourceId: string
  supplierName?: string | null
  packPrice: number
  unitsPerPack: number
  sizePerUnit: number
  sizeUnit: string
}

export interface AppliedSheet {
  /** `${source}:${sourceId}` of every entry that landed on a catalogue row. */
  applied: Set<string>
  /** Entries whose catalogue row no longer exists — surfaced, not silently dropped. */
  unmatched: Array<{ source: string; sourceId: string }>
}

/**
 * Overlays one operator's prices onto an index, in place.
 *
 * Mutating `entry.cost` rather than re-inserting into the map matters: an entry
 * is registered under both its id and its SKU, and both keys hold the *same*
 * object. Writing through the object covers every lookup path — including
 * `resolveCatalogueRef`'s name fallback.
 */
export function applyPriceSheet(index: CostIndex, entries: SheetEntryInput[]): AppliedSheet {
  const applied = new Set<string>()
  const unmatched: AppliedSheet['unmatched'] = []
  const asOf = new Date()

  for (const entry of entries) {
    const source = normalizeSource(entry.source)
    if (!source || !isCatalogueSource(source)) {
      unmatched.push({ source: entry.source, sourceId: entry.sourceId })
      continue
    }

    const key = catalogueKey(source, entry.sourceId)
    const target = index.catalogue.get(key)
    if (!target) {
      unmatched.push({ source: entry.source, sourceId: entry.sourceId })
      continue
    }

    const derived = deriveSheetUnitCost(entry)
    if (!derived) {
      unmatched.push({ source: entry.source, sourceId: entry.sourceId })
      continue
    }

    target.cost = {
      unitCost: derived.unitCost,
      unit: derived.unit,
      // The operator's own supplier name is what the UI badges the line with,
      // so they can see at a glance which prices are theirs.
      supplier: entry.supplierName?.trim() || `${source} (your price)`,
      sourceId: entry.sourceId,
      asOf,
      provenance: 'override',
      confidence: 1,
    }
    // A row that previously had no usable price now has one.
    target.reason = null
    applied.add(key)
  }

  return { applied, unmatched }
}

export interface IngredientUsageRow {
  /** `${source}:${id}` — the identity the sheet stores against. */
  key: string
  source: CatalogueSource
  sourceId: string
  code: string | null
  name: string
  /** Pack fields exactly as the supplier states them, for reference. */
  packSize: string | null
  uom: string | null
  ctnQty: string | null
  /** Our current cost per canonical unit, null when we can't price it either. */
  unitCost: number | null
  unitCostUnit: CanonicalUnit | null
  /** Why `unitCost` is null. */
  reason: string | null
  /** Pack structure we parsed, used to prefill the operator's inputs. */
  suggestedPack: { unitsPerPack: number; sizePerUnit: number; sizeUnit: string } | null
  /** Distinct components and variants naming this ingredient directly. */
  recipeCount: number
  usedIn: Array<{ type: 'component' | 'variant'; id: string; name: string }>
}

const USED_IN_LIMIT = 25

/**
 * The ingredients an operator can actually be asked to price.
 *
 * Not the supplier catalogues — those run to thousands of rows, most of which
 * we have never bought. This is the far smaller set that recipes reference,
 * plus every `Other` product (they are all hand-entered items we use), ranked
 * by how many recipes name each one so the first screen is the useful screen.
 *
 * Component lines and variant lines are both walked. Variant lines already
 * include base ingredients, title options and party-pack contents, because
 * `indexVariant` merged them when the index was built.
 */
export function collectIngredientUsage(index: CostIndex): IngredientUsageRow[] {
  const rows = new Map<string, IngredientUsageRow>()

  const entryRow = (entry: CatalogueEntry): IngredientUsageRow => {
    const key = catalogueKey(entry.source, entry.id)
    const existing = rows.get(key)
    if (existing) return existing

    const structure = entry.structure
    const created: IngredientUsageRow = {
      key,
      source: entry.source,
      sourceId: entry.id,
      code: entry.code,
      name: entry.name,
      packSize: entry.packSize,
      uom: entry.uom,
      ctnQty: entry.ctnQty,
      unitCost: entry.cost?.unitCost ?? null,
      unitCostUnit: entry.cost?.unit ?? null,
      reason: entry.cost ? null : entry.reason,
      suggestedPack: structure
        ? {
            unitsPerPack: structure.unitsPerPack,
            sizePerUnit: structure.sizePerUnit,
            sizeUnit: structure.sizeUnit,
          }
        : null,
      recipeCount: 0,
      usedIn: [],
    }
    rows.set(key, created)
    return created
  }

  const note = (
    lines: RecipeLine[],
    owner: { type: 'component' | 'variant'; id: string; name: string }
  ) => {
    // One recipe naming the same ingredient on two rows is one user of it.
    const seen = new Set<string>()
    for (const line of lines) {
      const source = normalizeSource(line.source)
      if (!source || !isCatalogueSource(source)) continue
      const entry = index.catalogue.get(catalogueKey(source, line.id))
      if (!entry) continue
      const row = entryRow(entry)
      if (seen.has(row.key)) continue
      seen.add(row.key)
      row.recipeCount += 1
      if (row.usedIn.length < USED_IN_LIMIT) row.usedIn.push(owner)
    }
  }

  for (const component of index.components.values()) {
    note(component.lines, { type: 'component', id: component.id, name: component.name })
  }
  for (const variant of index.variantsByVariantId.values()) {
    note(variant.lines, { type: 'variant', id: variant.variantId, name: variant.name })
  }

  // Every Other product, used or not: the list is hand-curated already, and an
  // operator pricing "Other" items expects to see all of them.
  for (const entry of index.catalogue.values()) {
    if (entry.source === 'Other') entryRow(entry)
  }

  return [...rows.values()].sort(
    (a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name)
  )
}

// --- Database-backed helpers ----------------------------------------------

type SheetPrismaClient = Pick<typeof defaultPrisma, 'priceSheetEntry'>

export async function loadSheetEntries(
  sheetId: string | null | undefined,
  client: SheetPrismaClient = defaultPrisma
): Promise<SheetEntryInput[]> {
  if (!sheetId) return []
  const rows = await client.priceSheetEntry.findMany({
    where: { sheetId },
    select: {
      source: true,
      sourceId: true,
      supplierName: true,
      packPrice: true,
      unitsPerPack: true,
      sizePerUnit: true,
      sizeUnit: true,
    },
  })
  return rows
}

/** An unsaved edit. A null `packPrice` means "drop back to the house price". */
export interface DraftEntry extends Omit<SheetEntryInput, 'packPrice'> {
  packPrice: number | null
}

/**
 * What the operator is looking at right now: their saved sheet, with any
 * unsaved edits taking precedence. A draft that clears a price removes the
 * saved row from the overlay rather than layering a zero on top of it.
 */
export function mergeDraftEntries(saved: SheetEntryInput[], drafts: DraftEntry[]): SheetEntryInput[] {
  if (!drafts.length) return saved
  const draftKeys = new Set(drafts.map((d) => `${d.source}:${d.sourceId}`))
  const merged = saved.filter((entry) => !draftKeys.has(`${entry.source}:${entry.sourceId}`))
  for (const draft of drafts) {
    if (draft.packPrice == null) continue
    merged.push({ ...draft, packPrice: draft.packPrice })
  }
  return merged
}

export interface LabIndexResult {
  index: CostIndex
  sheet: AppliedSheet | null
}

/**
 * The index every Pricing Lab route costs against: production data, with one
 * operator's prices laid over it. No sheet and no drafts gives the house view,
 * which is what the ingredient screen compares against.
 */
export async function buildLabIndex(
  params: { sheetId?: string | null; drafts?: DraftEntry[] },
  options: BuildCostIndexOptions = {}
): Promise<LabIndexResult> {
  const [index, saved] = await Promise.all([
    buildCostIndex(options),
    loadSheetEntries(params.sheetId),
  ])
  const entries = mergeDraftEntries(saved, params.drafts ?? [])
  if (!entries.length) return { index, sheet: null }
  return { index, sheet: applyPriceSheet(index, entries) }
}
