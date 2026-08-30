// Turning a recipe reference into a dated, attributable unit cost.
//
// Two resolution paths exist. `resolveIngredientCost` is the master path
// (Ingredient -> preferred IngredientSupplierLink -> latest PricePoint); it
// returns null until the Phase 3 backfill puts rows in those tables.
// `resolveLegacyRef` is the path every recipe row in the database uses today:
// a `(source, id)` pair pointing straight at a supplier catalogue table.
//
// `buildCostIndex` loads everything in one pass so recalc and the parity
// report don't repeat the current recalculate-costs route's per-ingredient,
// per-variant `findUnique` (N+1) loop.

import { prisma as defaultPrisma } from '../prisma'
import { type CostingPrismaClient, loadOptionIndex } from '../costing/load'
import { optionRowsForVariant } from '../costing/options'
import { PackStructure, deriveUnitPricing } from './packsize'
import { CanonicalUnit, fromLegacyOutputUnit, toCanonicalLoose } from './units'

export type CatalogueSource = 'Gilmours' | 'Bidfood' | 'ProduceCo' | 'Other'
export type RefSource = CatalogueSource | 'Components' | 'Products'
export type Provenance = 'pricepoint' | 'catalogue' | 'override'

export interface ResolvedCostValue {
  unitCost: number
  unit: CanonicalUnit
  supplier: string
  sourceId: string
  asOf: Date
  provenance: Provenance
  /** 0-1 from pack parsing; 1 for prices that need no interpretation. */
  confidence: number
}

export type ResolvedCost = ResolvedCostValue | null

export interface CatalogueEntry {
  source: CatalogueSource
  id: string
  /** SKU / product code, when the source has one. */
  code: string | null
  name: string
  /** Price exactly as stored, before any pack interpretation. */
  price: number | null
  /** Pack fields as the supplier supplied them, for verifying the reading. */
  packSize: string | null
  uom: string | null
  ctnQty: string | null
  /** How the pack was read. Feeds the Phase 3 verification queue. */
  structure: PackStructure | null
  cost: ResolvedCostValue | null
  /** Why `cost` is null. */
  reason: string | null
  isPreferred: boolean
  updatedAt: Date
}

/** One row of a `Component.ingredients` / `*.baseIngredients` JSON array. */
export interface RecipeLine {
  source: string
  id: string
  name: string
  quantity: number
  unit: string | null
  /** The `cost` frozen into the row when it was authored. */
  snapshotCost: number
  /** Reference into the Ingredient master; absent until Phase 3 stamps it. */
  ingredientId: string | null
  origin: 'base' | 'option' | 'variant' | 'component'
  position: number
}

export interface IndexedComponent {
  id: string
  name: string
  lines: RecipeLine[]
  /** Final usable output — already net of cooking loss. */
  producedQuantity: number
  producedUnit: string
  // Reference only. Costing never reads these: the loss they describe is
  // already taken out of producedQuantity, so applying them would double-count.
  rawWeight: number | null
  cookedWeight: number | null
  trimWasteWeight: number | null
  weightUnit: string | null
  storedTotalCost: number
  storedCostPerOutputUnit: number
  storedNormalizedOutputUnit: string
}

export interface IndexedVariant {
  id: string
  variantId: string
  productId: string
  name: string
  sku: string | null
  shopifyPriceInclGst: number
  storedTotalCost: number
  lines: RecipeLine[]
}

export interface PricingSettings {
  targetMargin: number
  backupCheaperPct: number
  spikePct: number
  gstRate: number
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  targetMargin: 0.7,
  backupCheaperPct: 0.15,
  spikePct: 0.1,
  gstRate: 0.15,
}

export interface CostIndex {
  builtAt: Date
  /** Keyed by `${source}:${id}` and, where available, `${source}:${code}`. */
  catalogue: Map<string, CatalogueEntry>
  /** `${source}:${lowercased name}` -> catalogue keys, for last-resort lookup. */
  catalogueByName: Map<string, string[]>
  components: Map<string, IndexedComponent>
  componentIdByName: Map<string, string>
  variantsByVariantId: Map<string, IndexedVariant>
  variantsById: Map<string, IndexedVariant>
  variantIdsByProductId: Map<string, string[]>
  /** Ingredient.id -> cost. Empty until the Phase 3 backfill runs. */
  ingredientCosts: Map<string, ResolvedCostValue>
  /** `${scope}:${refId}` -> active CostOverride. */
  overrides: Map<string, ResolvedCostValue>
  settings: PricingSettings
  options: CostIndexOptions
}

export interface CostIndexOptions {
  /** When false (the default) a catalogue price of 0 is unknown, not free. */
  treatZeroPriceAsFree: boolean
}

export const DEFAULT_COST_INDEX_OPTIONS: CostIndexOptions = {
  treatZeroPriceAsFree: false,
}

// Structural row shapes rather than Prisma types, so tests can build an index
// from plain objects without a database.
export interface GilmoursRow {
  id: string
  sku?: string | null
  brand?: string | null
  description?: string | null
  packSize?: string | null
  uom?: string | null
  price: number
  isPreferred?: boolean
  updatedAt?: Date | string | null
}

export interface BidfoodRow {
  id: string
  productCode?: string | null
  brand?: string | null
  description?: string | null
  packSize?: string | null
  ctnQty?: string | number | null
  uom?: string | null
  lastPricePaid: number
  isPreferred?: boolean
  updatedAt?: Date | string | null
}

export interface ProduceCoRow {
  id: string
  productCode?: string | null
  productName?: string | null
  price: number
  isPreferred?: boolean
  updatedAt?: Date | string | null
}

export interface OtherRow {
  id: string
  name?: string | null
  supplier?: string | null
  description?: string | null
  cost: number
  isPreferred?: boolean
  updatedAt?: Date | string | null
}

export interface ComponentRow {
  id: string
  name: string
  ingredients?: unknown
  totalCost?: number | null
  producedQuantity?: number | null
  producedUnit?: string | null
  normalizedOutputUnit?: string | null
  costPerOutputUnit?: number | null
  rawWeight?: number | null
  cookedWeight?: number | null
  trimWasteWeight?: number | null
  weightUnit?: string | null
}

export interface VariantRow {
  id: string
  variantId: string
  productId: string
  shopifyName?: string | null
  shopifyTitle?: string | null
  shopifySku?: string | null
  shopifyPrice?: unknown
  totalCost?: number | null
  ingredients?: unknown
  baseIngredients?: unknown
  product?: { baseIngredients?: unknown } | null
  /**
   * Rows contributed by the choices in this variant's title, already summed
   * and scaled to the product's portion size. Supplied by `buildCostIndex`;
   * absent for callers that construct an index by hand.
   */
  optionIngredients?: unknown
}

export interface IngredientRow {
  id: string
  name: string
  canonicalUnit: string
}

export interface SupplierLinkRow {
  id: string
  ingredientId: string
  source: string
  sourceId: string
  rank: number
  packConfidence?: number | null
}

export interface PricePointRow {
  linkId: string
  unitCost: number
  effectiveAt: Date | string
}

export interface CostIndexInput {
  gilmours?: GilmoursRow[]
  bidfood?: BidfoodRow[]
  produceCo?: ProduceCoRow[]
  other?: OtherRow[]
  components?: ComponentRow[]
  variants?: VariantRow[]
  /** Master list. Costs are derived from these unless `ingredientCosts` is given. */
  ingredients?: IngredientRow[]
  links?: SupplierLinkRow[]
  /** Latest point per link. Extra rows are tolerated; the newest wins. */
  pricePoints?: PricePointRow[]
  /** Pre-resolved master costs, bypassing the rows above. For tests. */
  ingredientCosts?: Map<string, ResolvedCostValue> | Array<[string, ResolvedCostValue]>
  overrides?: Map<string, ResolvedCostValue> | Array<[string, ResolvedCostValue]>
  settings?: Partial<PricingSettings>
  options?: Partial<CostIndexOptions>
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (value == null) return fallback
  const parsed = Number(String(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

export function normalizeSource(source: string | null | undefined): RefSource | null {
  const token = String(source ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!token) return null
  if (token === 'gilmours' || token === 'gilmour') return 'Gilmours'
  if (token === 'bidfood') return 'Bidfood'
  if (token === 'produceco' || token === 'producecompany' || token === 'produce') return 'ProduceCo'
  if (token === 'other' || token === 'others') return 'Other'
  if (token === 'components' || token === 'component') return 'Components'
  if (token === 'products' || token === 'product') return 'Products'
  return null
}

export function isCatalogueSource(source: RefSource | null): source is CatalogueSource {
  return source === 'Gilmours' || source === 'Bidfood' || source === 'ProduceCo' || source === 'Other'
}

export function catalogueKey(source: CatalogueSource, id: string): string {
  return `${source}:${id}`
}

/** Normalises one JSON ingredient array into typed lines, skipping empty rows. */
export function parseRecipeLines(value: unknown, origin: RecipeLine['origin']): RecipeLine[] {
  if (!Array.isArray(value)) return []
  const lines: RecipeLine[] = []
  value.forEach((raw, position) => {
    if (!raw || typeof raw !== 'object') return
    const row = raw as Record<string, unknown>
    const source = String(row.source ?? '').trim()
    const id = String(row.id ?? row.sku ?? row.productCode ?? row.code ?? '').trim()
    const name = String(row.name ?? row.description ?? '').trim()
    if (!source && !id && !name) return
    const unitRaw = row.unit == null ? '' : String(row.unit).trim()
    lines.push({
      source,
      id,
      name,
      quantity: num(row.quantity, 0),
      unit: unitRaw || null,
      snapshotCost: num(row.cost ?? row.price, 0),
      ingredientId: row.ingredientId ? String(row.ingredientId) : null,
      origin,
      position,
    })
  })
  return lines
}

/** Same identity as `rowKey` in the costing lib, on an already-parsed line. */
function recipeLineKey(line: RecipeLine): string {
  const source = line.source.trim().toLowerCase()
  const id = line.id.trim().toLowerCase()
  if (id) return `${source}:${id}`
  return `${source}:name:${line.name.trim().toLowerCase()}`
}

function priceProblem(price: number | null | undefined, options: CostIndexOptions): string | null {
  if (price == null || !Number.isFinite(price)) return 'no-price'
  if (price < 0) return 'negative-price'
  if (price === 0 && !options.treatZeroPriceAsFree) return 'zero-price'
  return null
}

function gilmoursEntry(row: GilmoursRow, options: CostIndexOptions): CatalogueEntry {
  const updatedAt = toDate(row.updatedAt)
  const price = num(row.price, Number.NaN)
  const name = String(row.description ?? '').trim() || String(row.sku ?? row.id)
  const base: CatalogueEntry = {
    source: 'Gilmours',
    id: row.id,
    code: row.sku ? String(row.sku) : null,
    name,
    price: Number.isFinite(price) ? price : null,
    packSize: row.packSize ?? null,
    uom: row.uom ?? null,
    ctnQty: null,
    structure: null,
    cost: null,
    reason: null,
    isPreferred: Boolean(row.isPreferred),
    updatedAt,
  }
  const problem = priceProblem(base.price, options)
  if (problem) return { ...base, reason: problem }

  const derived = deriveUnitPricing({ packSize: row.packSize, uom: row.uom, price: base.price })
  if (!derived) return { ...base, reason: 'pack-size-unparseable' }
  return {
    ...base,
    structure: derived.structure,
    cost: {
      unitCost: derived.unitCost,
      unit: derived.unit,
      supplier: 'Gilmours',
      sourceId: row.id,
      asOf: updatedAt,
      provenance: 'catalogue',
      confidence: derived.confidence,
    },
  }
}

function bidfoodEntry(row: BidfoodRow, options: CostIndexOptions): CatalogueEntry {
  const updatedAt = toDate(row.updatedAt)
  const price = num(row.lastPricePaid, Number.NaN)
  const name = String(row.description ?? '').trim() || String(row.productCode ?? row.id)
  const base: CatalogueEntry = {
    source: 'Bidfood',
    id: row.id,
    code: row.productCode ? String(row.productCode) : null,
    name,
    price: Number.isFinite(price) ? price : null,
    packSize: row.packSize ?? null,
    uom: row.uom ?? null,
    ctnQty: row.ctnQty == null ? null : String(row.ctnQty),
    structure: null,
    cost: null,
    reason: null,
    isPreferred: Boolean(row.isPreferred),
    updatedAt,
  }
  const problem = priceProblem(base.price, options)
  if (problem) return { ...base, reason: problem }

  const derived = deriveUnitPricing({
    packSize: row.packSize,
    uom: row.uom,
    ctnQty: row.ctnQty,
    price: base.price,
  })
  if (!derived) return { ...base, reason: 'pack-size-unparseable' }
  return {
    ...base,
    structure: derived.structure,
    cost: {
      unitCost: derived.unitCost,
      unit: derived.unit,
      supplier: 'Bidfood',
      sourceId: row.id,
      asOf: updatedAt,
      provenance: 'catalogue',
      confidence: derived.confidence,
    },
  }
}

// ProduceCoProduct carries no pack size, so the price is taken as a price per
// item as sold. Guessing a weight out of the product name would be inventing
// data; confidence stays moderate so the verification queue picks these up.
function produceCoEntry(row: ProduceCoRow, options: CostIndexOptions): CatalogueEntry {
  const updatedAt = toDate(row.updatedAt)
  const price = num(row.price, Number.NaN)
  const name = String(row.productName ?? '').trim() || String(row.productCode ?? row.id)
  const base: CatalogueEntry = {
    source: 'ProduceCo',
    id: row.id,
    code: row.productCode ? String(row.productCode) : null,
    name,
    price: Number.isFinite(price) ? price : null,
    packSize: null,
    uom: null,
    ctnQty: null,
    structure: null,
    cost: null,
    reason: null,
    isPreferred: Boolean(row.isPreferred),
    updatedAt,
  }
  const problem = priceProblem(base.price, options)
  if (problem) return { ...base, reason: problem }

  return {
    ...base,
    cost: {
      unitCost: base.price as number,
      unit: 'each',
      supplier: 'ProduceCo',
      sourceId: row.id,
      asOf: updatedAt,
      provenance: 'catalogue',
      confidence: 0.6,
    },
  }
}

function otherEntry(row: OtherRow, options: CostIndexOptions): CatalogueEntry {
  const updatedAt = toDate(row.updatedAt)
  const price = num(row.cost, Number.NaN)
  const name = String(row.name ?? '').trim() || row.id
  const base: CatalogueEntry = {
    source: 'Other',
    id: row.id,
    code: null,
    name,
    price: Number.isFinite(price) ? price : null,
    packSize: null,
    uom: null,
    ctnQty: null,
    structure: null,
    cost: null,
    reason: null,
    isPreferred: Boolean(row.isPreferred),
    updatedAt,
  }
  const problem = priceProblem(base.price, options)
  if (problem) return { ...base, reason: problem }

  return {
    ...base,
    cost: {
      unitCost: base.price as number,
      unit: 'each',
      supplier: String(row.supplier ?? '').trim() || 'Other',
      sourceId: row.id,
      asOf: updatedAt,
      provenance: 'catalogue',
      confidence: 0.8,
    },
  }
}

function indexComponent(row: ComponentRow): IndexedComponent {
  return {
    id: row.id,
    name: row.name,
    lines: parseRecipeLines(row.ingredients, 'component'),
    producedQuantity: num(row.producedQuantity, 1),
    producedUnit: String(row.producedUnit ?? 'unit'),
    rawWeight: row.rawWeight == null ? null : num(row.rawWeight, 0),
    cookedWeight: row.cookedWeight == null ? null : num(row.cookedWeight, 0),
    trimWasteWeight: row.trimWasteWeight == null ? null : num(row.trimWasteWeight, 0),
    weightUnit: row.weightUnit ?? null,
    storedTotalCost: num(row.totalCost, 0),
    storedCostPerOutputUnit: num(row.costPerOutputUnit, 0),
    storedNormalizedOutputUnit: String(row.normalizedOutputUnit ?? 'unit'),
  }
}

function indexVariant(row: VariantRow): IndexedVariant {
  const base = parseRecipeLines(row.baseIngredients ?? row.product?.baseIngredients, 'base')
  const fromOptions = parseRecipeLines(row.optionIngredients, 'option')
  // A variant still carries whatever the old rules sprayed onto it. Rows an
  // option now supplies are dropped rather than added, or the ingredient would
  // be counted twice; the rest are kept so nothing silently loses its cost
  // before the catalogue is fully migrated.
  const supplied = new Set(fromOptions.map(recipeLineKey))
  const own = parseRecipeLines(row.ingredients, 'variant').filter(
    (line) => !supplied.has(recipeLineKey(line))
  )
  return {
    id: row.id,
    variantId: row.variantId,
    productId: row.productId,
    name: String(row.shopifyTitle ?? row.shopifyName ?? row.variantId),
    sku: row.shopifySku ? String(row.shopifySku) : null,
    shopifyPriceInclGst: num(row.shopifyPrice, 0),
    storedTotalCost: num(row.totalCost, 0),
    // Base first, then the title's choices, then any legacy rows that survive.
    lines: [...base, ...fromOptions, ...own],
  }
}

function toMap<T>(value: Map<string, T> | Array<[string, T]> | undefined): Map<string, T> {
  if (!value) return new Map()
  return value instanceof Map ? new Map(value) : new Map(value)
}

/**
 * Batched equivalent of `resolveIngredientCost` for every ingredient at once:
 * active override, then the lowest-rank link with price history, then the
 * lowest-rank link whose catalogue row still carries a usable price.
 *
 * An ingredient that resolves nothing is left out of the map entirely, so a
 * caller sees "unknown" rather than a zero.
 */
function resolveMasterCosts(
  ingredients: IngredientRow[],
  links: SupplierLinkRow[],
  pricePoints: PricePointRow[],
  catalogue: Map<string, CatalogueEntry>,
  overrides: Map<string, ResolvedCostValue>
): Map<string, ResolvedCostValue> {
  const out = new Map<string, ResolvedCostValue>()
  if (!ingredients.length) return out

  const latestByLink = new Map<string, PricePointRow>()
  for (const point of pricePoints) {
    const current = latestByLink.get(point.linkId)
    if (!current || toDate(point.effectiveAt) > toDate(current.effectiveAt)) latestByLink.set(point.linkId, point)
  }

  const linksByIngredient = new Map<string, SupplierLinkRow[]>()
  for (const link of links) {
    const bucket = linksByIngredient.get(link.ingredientId)
    if (bucket) bucket.push(link)
    else linksByIngredient.set(link.ingredientId, [link])
  }
  for (const bucket of linksByIngredient.values()) bucket.sort((a, b) => a.rank - b.rank)

  for (const ingredient of ingredients) {
    const override = overrides.get(`ingredient:${ingredient.id}`)
    if (override) {
      out.set(ingredient.id, override)
      continue
    }

    const bucket = linksByIngredient.get(ingredient.id)
    if (!bucket?.length) continue
    const unit = fromLegacyOutputUnit(ingredient.canonicalUnit)

    let resolved: ResolvedCostValue | null = null
    for (const link of bucket) {
      const latest = latestByLink.get(link.id)
      if (!latest || !Number.isFinite(latest.unitCost)) continue
      resolved = {
        unitCost: latest.unitCost,
        unit,
        supplier: link.source,
        sourceId: link.sourceId,
        asOf: toDate(latest.effectiveAt),
        provenance: 'pricepoint',
        confidence: link.packConfidence ?? 1,
      }
      break
    }

    // No history yet: read straight off the linked catalogue row.
    if (!resolved) {
      for (const link of bucket) {
        const source = normalizeSource(link.source)
        if (!isCatalogueSource(source)) continue
        const entry = catalogue.get(catalogueKey(source, link.sourceId))
        if (entry?.cost) {
          resolved = entry.cost
          break
        }
      }
    }

    if (resolved) out.set(ingredient.id, resolved)
  }

  return out
}

/** Pure index builder. `buildCostIndex` is the database-backed wrapper. */
export function createCostIndex(input: CostIndexInput): CostIndex {
  const options: CostIndexOptions = { ...DEFAULT_COST_INDEX_OPTIONS, ...(input.options ?? {}) }
  const settings: PricingSettings = { ...DEFAULT_PRICING_SETTINGS, ...(input.settings ?? {}) }

  const catalogue = new Map<string, CatalogueEntry>()
  const catalogueByName = new Map<string, string[]>()

  const register = (entry: CatalogueEntry) => {
    const primary = catalogueKey(entry.source, entry.id)
    catalogue.set(primary, entry)
    if (entry.code) {
      const alias = catalogueKey(entry.source, entry.code)
      if (!catalogue.has(alias)) catalogue.set(alias, entry)
    }
    const nameKey = `${entry.source}:${entry.name.trim().toLowerCase()}`
    const bucket = catalogueByName.get(nameKey)
    if (bucket) bucket.push(primary)
    else catalogueByName.set(nameKey, [primary])
  }

  for (const row of input.gilmours ?? []) register(gilmoursEntry(row, options))
  for (const row of input.bidfood ?? []) register(bidfoodEntry(row, options))
  for (const row of input.produceCo ?? []) register(produceCoEntry(row, options))
  for (const row of input.other ?? []) register(otherEntry(row, options))

  const components = new Map<string, IndexedComponent>()
  const componentIdByName = new Map<string, string>()
  for (const row of input.components ?? []) {
    const indexed = indexComponent(row)
    components.set(indexed.id, indexed)
    componentIdByName.set(indexed.name.trim().toLowerCase(), indexed.id)
  }

  const variantsByVariantId = new Map<string, IndexedVariant>()
  const variantsById = new Map<string, IndexedVariant>()
  const variantIdsByProductId = new Map<string, string[]>()
  for (const row of input.variants ?? []) {
    const indexed = indexVariant(row)
    variantsByVariantId.set(indexed.variantId, indexed)
    variantsById.set(indexed.id, indexed)
    const bucket = variantIdsByProductId.get(indexed.productId)
    if (bucket) bucket.push(indexed.variantId)
    else variantIdsByProductId.set(indexed.productId, [indexed.variantId])
  }

  const overrides = toMap(input.overrides)
  const ingredientCosts = input.ingredientCosts
    ? toMap(input.ingredientCosts)
    : resolveMasterCosts(input.ingredients ?? [], input.links ?? [], input.pricePoints ?? [], catalogue, overrides)

  return {
    builtAt: new Date(),
    catalogue,
    catalogueByName,
    components,
    componentIdByName,
    variantsByVariantId,
    variantsById,
    variantIdsByProductId,
    ingredientCosts,
    overrides,
    settings,
    options,
  }
}

// --- Ingredient master ----------------------------------------------------
// Ingredient, IngredientSupplierLink, PricePoint, CostOverride and
// PricingSettings are real tables now, so these read them directly. The tables
// are empty until the Phase 3 backfill populates them, which is why every
// caller still falls back to the legacy (source, id) catalogue path.

/** Any Prisma client — the shared singleton, or a transaction handle. */
export type PricingPrismaClient = Pick<
  typeof defaultPrisma,
  | 'gilmoursProduct'
  | 'bidfoodProduct'
  | 'produceCoProduct'
  | 'otherProduct'
  | 'component'
  | 'productVariant'
  | 'ingredient'
  | 'ingredientSupplierLink'
  | 'pricePoint'
  | 'costOverride'
  | 'pricingSettings'
  | 'priceAlert'
>

/** Falls back to the shipped defaults when the singleton row is absent. */
export async function loadPricingSettings(
  client: PricingPrismaClient = defaultPrisma
): Promise<PricingSettings> {
  const row = await client.pricingSettings.findFirst()
  if (!row) return { ...DEFAULT_PRICING_SETTINGS }
  return {
    targetMargin: num(row.targetMargin, DEFAULT_PRICING_SETTINGS.targetMargin),
    backupCheaperPct: num(row.backupCheaperPct, DEFAULT_PRICING_SETTINGS.backupCheaperPct),
    spikePct: num(row.spikePct, DEFAULT_PRICING_SETTINGS.spikePct),
    // Not a stored setting: NZ GST is a statutory rate, not a preference.
    gstRate: DEFAULT_PRICING_SETTINGS.gstRate,
  }
}

async function loadActiveOverrides(client: PricingPrismaClient): Promise<Map<string, ResolvedCostValue>> {
  const out = new Map<string, ResolvedCostValue>()
  const rows = await client.costOverride.findMany({
    where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  })
  for (const row of rows) {
    if (!row.scope || !row.refId) continue
    out.set(`${row.scope}:${row.refId}`, {
      unitCost: row.unitCost,
      unit: fromLegacyOutputUnit(row.unit),
      supplier: 'override',
      sourceId: row.refId,
      asOf: row.createdAt,
      provenance: 'override',
      confidence: 1,
    })
  }
  return out
}

export interface BuildCostIndexOptions extends Partial<CostIndexOptions> {
  client?: PricingPrismaClient
  settings?: Partial<PricingSettings>
  /**
   * Skip the variant pass. Variants are the most expensive part of the load
   * (1300 rows of recipe JSON) and are only needed to cost a `Products` recipe
   * line or to run the variant pass of a recalc. Costing a single component on
   * save needs neither.
   */
  includeVariants?: boolean
  /**
   * When false, variants are costed from their stored rows alone, ignoring the
   * CostingOption catalogue. Only the parity report uses this, to measure what
   * option-based costing changes without live prices confusing the comparison.
   */
  includeCostingOptions?: boolean
}

/**
 * Loads every catalogue, component and variant in a handful of queries.
 * Deliberately not paginated: the whole point is one pass instead of the
 * per-ingredient lookups the current recalc route does inside nested loops.
 */
export async function buildCostIndex(opts: BuildCostIndexOptions = {}): Promise<CostIndex> {
  const client = opts.client ?? defaultPrisma
  const {
    client: _client,
    settings: settingsOverride,
    includeVariants = true,
    includeCostingOptions = true,
    ...indexOptions
  } = opts

  const [gilmours, bidfood, produceCo, other, components, variants, optionIndex, settings, overrides] =
    await Promise.all([
    client.gilmoursProduct.findMany({
      select: {
        id: true,
        sku: true,
        description: true,
        packSize: true,
        uom: true,
        price: true,
        isPreferred: true,
        updatedAt: true,
      },
    }),
    client.bidfoodProduct.findMany({
      select: {
        id: true,
        productCode: true,
        description: true,
        packSize: true,
        ctnQty: true,
        uom: true,
        lastPricePaid: true,
        isPreferred: true,
        updatedAt: true,
      },
    }),
    client.produceCoProduct.findMany({
      select: {
        id: true,
        productCode: true,
        productName: true,
        price: true,
        isPreferred: true,
        updatedAt: true,
      },
    }),
    client.otherProduct.findMany({
      select: {
        id: true,
        name: true,
        supplier: true,
        cost: true,
        isPreferred: true,
        updatedAt: true,
      },
    }),
    client.component.findMany({
      select: {
        id: true,
        name: true,
        ingredients: true,
        totalCost: true,
        producedQuantity: true,
        producedUnit: true,
        normalizedOutputUnit: true,
        costPerOutputUnit: true,
        rawWeight: true,
        cookedWeight: true,
        trimWasteWeight: true,
        weightUnit: true,
      },
    }),
    includeVariants
      ? client.productVariant.findMany({
          select: {
            id: true,
            variantId: true,
            productId: true,
            shopifyName: true,
            shopifyTitle: true,
            shopifySku: true,
            shopifyPrice: true,
            totalCost: true,
            ingredients: true,
            product: { select: { baseIngredients: true } },
          },
        })
      : Promise.resolve([]),
    includeVariants && includeCostingOptions
      ? loadOptionIndex(client as unknown as CostingPrismaClient)
      : Promise.resolve(null),
    loadPricingSettings(client),
    loadActiveOverrides(client),
  ])

  // The master list, in three queries rather than one per ingredient.
  // `distinct` on a linkId-then-newest ordering gives the latest point per
  // link without pulling the whole price history.
  const [ingredients, links, pricePoints] = await Promise.all([
    client.ingredient.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, canonicalUnit: true },
    }),
    client.ingredientSupplierLink.findMany({
      where: { active: true },
      orderBy: { rank: 'asc' },
      select: { id: true, ingredientId: true, source: true, sourceId: true, rank: true, packConfidence: true },
    }),
    client.pricePoint.findMany({
      orderBy: [{ linkId: 'asc' }, { effectiveAt: 'desc' }],
      distinct: ['linkId'],
      select: { linkId: true, unitCost: true, effectiveAt: true },
    }),
  ])

  return createCostIndex({
    gilmours: gilmours as GilmoursRow[],
    bidfood: bidfood as BidfoodRow[],
    produceCo: produceCo as ProduceCoRow[],
    other: other as OtherRow[],
    components: components as ComponentRow[],
    variants: variants.map((v) => ({
      ...v,
      shopifyPrice: v.shopifyPrice == null ? 0 : Number(v.shopifyPrice),
      optionIngredients: optionIndex
        ? optionRowsForVariant(v.shopifyName ?? '', v.productId, optionIndex).rows
        : [],
    })) as VariantRow[],
    ingredients,
    links,
    pricePoints,
    overrides,
    settings: { ...settings, ...(settingsOverride ?? {}) },
    options: indexOptions,
  })
}

/** Catalogue lookup against a prebuilt index, with a code and name fallback. */
export function resolveCatalogueRef(
  index: CostIndex,
  source: CatalogueSource,
  id: string,
  name?: string
): { entry: CatalogueEntry; matchedBy: 'id' | 'name' } | null {
  const direct = index.catalogue.get(catalogueKey(source, id))
  if (direct) return { entry: direct, matchedBy: 'id' }

  const trimmedName = String(name ?? '').trim().toLowerCase()
  if (!trimmedName) return null
  const candidates = index.catalogueByName.get(`${source}:${trimmedName}`)
  // Only fall back on an unambiguous name match; guessing between duplicates
  // is how the wrong ingredient ends up priced.
  if (!candidates || candidates.length !== 1) return null
  const entry = index.catalogue.get(candidates[0])
  return entry ? { entry, matchedBy: 'name' } : null
}

/**
 * Master path: active override, then the preferred (rank 1) supplier link's
 * latest PricePoint, then lower-ranked links, then the link's catalogue row.
 * Returns null — never 0 — when nothing resolves.
 */
export async function resolveIngredientCost(
  ingredientId: string,
  client: PricingPrismaClient = defaultPrisma
): Promise<ResolvedCost> {
  if (!ingredientId) return null

  const override = await client.costOverride.findFirst({
    where: {
      scope: 'ingredient',
      refId: ingredientId,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  })
  if (override) {
    return {
      unitCost: override.unitCost,
      unit: fromLegacyOutputUnit(override.unit),
      supplier: 'override',
      sourceId: ingredientId,
      asOf: override.createdAt,
      provenance: 'override',
      confidence: 1,
    }
  }

  const ingredient = await client.ingredient.findUnique({ where: { id: ingredientId } })
  if (!ingredient) return null
  const canonicalUnit = fromLegacyOutputUnit(ingredient.canonicalUnit)

  const links = await client.ingredientSupplierLink.findMany({
    where: { ingredientId, active: true },
    orderBy: { rank: 'asc' },
    include: { pricePoints: { orderBy: { effectiveAt: 'desc' }, take: 1 } },
  })

  for (const link of links) {
    const latest = link.pricePoints[0]
    if (!latest || !Number.isFinite(latest.unitCost)) continue
    return {
      unitCost: latest.unitCost,
      unit: canonicalUnit,
      supplier: link.source,
      sourceId: link.sourceId,
      asOf: latest.effectiveAt,
      provenance: 'pricepoint',
      confidence: link.packConfidence ?? 1,
    }
  }

  // No price history yet: fall back to the linked catalogue row.
  for (const link of links) {
    const source = normalizeSource(link.source)
    if (!isCatalogueSource(source)) continue
    const fallback = await resolveLegacyRef(source, link.sourceId, client)
    if (fallback) return fallback
  }

  return null
}

/**
 * The path every recipe row uses today: a raw `(source, id)` pair. Single-ref
 * convenience wrapper — use `buildCostIndex` for anything that loops.
 */
export async function resolveLegacyRef(
  source: string,
  id: string,
  client: PricingPrismaClient = defaultPrisma,
  options: CostIndexOptions = DEFAULT_COST_INDEX_OPTIONS
): Promise<ResolvedCost> {
  const normalized = normalizeSource(source)
  if (!normalized || !id) return null
  const db = client

  if (normalized === 'Gilmours') {
    const row = await db.gilmoursProduct.findUnique({ where: { id } })
    return row ? gilmoursEntry(row as GilmoursRow, options).cost : null
  }
  if (normalized === 'Bidfood') {
    const row = await db.bidfoodProduct.findUnique({ where: { id } })
    return row ? bidfoodEntry(row as BidfoodRow, options).cost : null
  }
  if (normalized === 'ProduceCo') {
    const row = await db.produceCoProduct.findUnique({ where: { id } })
    return row ? produceCoEntry(row as ProduceCoRow, options).cost : null
  }
  if (normalized === 'Other') {
    const row = await db.otherProduct.findUnique({ where: { id } })
    return row ? otherEntry(row as OtherRow, options).cost : null
  }

  // Components and Products read their stored derived values here. Anything
  // that needs a fresh, nesting-aware number should call costComponent /
  // costVariant against an index instead.
  if (normalized === 'Components') {
    const row = await db.component.findUnique({ where: { id } })
    if (!row) return null
    const perUnit = num(row.costPerOutputUnit, 0)
    if (!(perUnit > 0)) return null
    return {
      unitCost: perUnit,
      unit: fromLegacyOutputUnit(row.normalizedOutputUnit),
      supplier: 'Components',
      sourceId: row.id,
      asOf: row.updatedAt,
      provenance: 'catalogue',
      confidence: 1,
    }
  }

  if (normalized === 'Products') {
    const row = await db.productVariant.findUnique({ where: { variantId: id } })
    if (!row) return null
    const total = num(row.totalCost, 0)
    if (!(total > 0)) return null
    return {
      unitCost: total,
      unit: 'each',
      supplier: 'Products',
      sourceId: row.variantId,
      asOf: row.updatedAt,
      provenance: 'catalogue',
      confidence: 1,
    }
  }

  return null
}

/** Convenience for callers holding an index: component output unit as canonical. */
export function componentOutputUnit(component: IndexedComponent): CanonicalUnit {
  return toCanonicalLoose(component.producedQuantity, component.producedUnit).unit
}
