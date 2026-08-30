// Server-derived costs at save time.
//
// Before this, `POST/PUT /api/components` persisted `Number(body.totalCost)` —
// whatever the browser calculated — and `bulk-update-components` wrote
// `totalCost` without touching `costPerOutputUnit`, so the two silently drifted
// apart. Both now recompute through the engine and ignore the client's figure.
//
// The client's `totalCost` is still accepted and still returned, so no caller
// has to change; it is simply no longer believed.
//
// Variant saves had the same fault with a sharper edge: the browser sums only
// the rows shown in the variant editor, which are the variant's *own* rows.
// A variant of a product with a base recipe therefore saved a total with the
// whole base missing.

import { prisma as defaultPrisma } from '../prisma'
import { CostResult, costComponent, costVariant } from './cost'
import {
  CostIndex,
  PricingPrismaClient,
  buildCostIndex,
  isCatalogueSource,
  normalizeSource,
  parseRecipeLines,
} from './resolve'
import { toCanonicalLoose, toLegacyOutputUnit } from './units'

export interface ComponentCostWrite {
  totalCost: number
  costPerOutputUnit: number
  normalizedOutputUnit: string
}

export interface ComponentCostOutcome extends ComponentCostWrite {
  /** False when a line could not be costed and the client figure was kept. */
  serverDerived: boolean
  /** Distinct reasons the engine could not cost every line. */
  reasons: string[]
  coverage: { resolvedLines: number; totalLines: number }
}

/** Legacy fallback, used only when the engine cannot cost the recipe at all. */
function fallbackWrite(totalCost: number, producedQuantity: number, producedUnit: string): ComponentCostWrite {
  const output = toCanonicalLoose(producedQuantity, producedUnit)
  return {
    totalCost,
    costPerOutputUnit: output.qty > 0 ? totalCost / output.qty : 0,
    normalizedOutputUnit: toLegacyOutputUnit(output.unit),
  }
}

/** Does any line point at a ProductVariant? Decides whether the index needs them. */
function referencesVariants(lines: unknown): boolean {
  return parseRecipeLines(lines, 'component').some((l) => normalizeSource(l.source) === 'Products')
}

export interface ComputeComponentCostInput {
  /** Omitted when costing a component that does not exist yet. */
  componentId?: string | null
  name: string
  ingredients: unknown
  producedQuantity: number
  producedUnit: string
  /** Only used if the engine cannot produce a number. */
  clientTotalCost: number
}

/**
 * Costs one component's draft recipe. Builds a scoped index rather than the
 * full one: a save must not pay for loading 1300 variants.
 */
export async function computeComponentCost(
  input: ComputeComponentCostInput,
  client: PricingPrismaClient = defaultPrisma
): Promise<ComponentCostOutcome> {
  const index = await buildCostIndex({ client, includeVariants: referencesVariants(input.ingredients) })

  // Overlay the draft onto the index so nested lookups see the edit, not the
  // version still in the database.
  const draftId = input.componentId ?? `__draft__${Date.now()}`
  const existing = input.componentId ? index.components.get(input.componentId) : undefined
  index.components.set(draftId, {
    id: draftId,
    name: input.name,
    lines: parseRecipeLines(input.ingredients, 'component'),
    producedQuantity: input.producedQuantity,
    producedUnit: input.producedUnit,
    rawWeight: existing?.rawWeight ?? null,
    cookedWeight: existing?.cookedWeight ?? null,
    trimWasteWeight: existing?.trimWasteWeight ?? null,
    weightUnit: existing?.weightUnit ?? null,
    storedTotalCost: existing?.storedTotalCost ?? 0,
    storedCostPerOutputUnit: existing?.storedCostPerOutputUnit ?? 0,
    storedNormalizedOutputUnit: existing?.storedNormalizedOutputUnit ?? 'unit',
  })
  index.componentIdByName.set(input.name.trim().toLowerCase(), draftId)

  const result = costComponent(draftId, index)
  return outcomeFrom(result, input.clientTotalCost, input.producedQuantity, input.producedUnit)
}

function outcomeFrom(
  result: CostResult,
  clientTotalCost: number,
  producedQuantity: number,
  producedUnit: string
): ComponentCostOutcome {
  const reasons = [...new Set(result.missing.map((m) => m.reason))]
  const coverage = { resolvedLines: result.coverage.resolvedLines, totalLines: result.coverage.totalLines }

  // An empty recipe genuinely costs nothing; that is not a failure to resolve.
  if (result.total != null && result.perUnit != null) {
    return {
      totalCost: result.total,
      costPerOutputUnit: result.perUnit,
      normalizedOutputUnit: result.unit,
      serverDerived: true,
      reasons,
      coverage,
    }
  }

  return {
    ...fallbackWrite(clientTotalCost, producedQuantity, producedUnit),
    serverDerived: false,
    reasons: reasons.length ? reasons : ['no-cost-resolved'],
    coverage,
  }
}

export interface BulkComponentCostInput extends ComputeComponentCostInput {
  /** Caller's handle for this row; results come back under the same key. */
  key: string
}

/**
 * Costs many components against one shared index — for bulk-update, where
 * building an index per row would be absurd. Handles rows being created in the
 * same batch, so a new component can be referenced by another row's recipe.
 */
export async function computeComponentCostsBulk(
  inputs: BulkComponentCostInput[],
  client: PricingPrismaClient = defaultPrisma
): Promise<Map<string, ComponentCostOutcome>> {
  const out = new Map<string, ComponentCostOutcome>()
  if (!inputs.length) return out

  const index = await buildCostIndex({
    client,
    includeVariants: inputs.some((i) => referencesVariants(i.ingredients)),
  })

  // Apply every draft before costing any of them, so a batch that edits two
  // components costs each against the other's new recipe rather than the
  // version still in the database.
  const indexIdByKey = new Map<string, string>()
  for (const input of inputs) {
    const lines = parseRecipeLines(input.ingredients, 'component')
    const existing = input.componentId ? index.components.get(input.componentId) : undefined
    if (existing) {
      existing.lines = lines
      existing.producedQuantity = input.producedQuantity
      existing.producedUnit = input.producedUnit
      indexIdByKey.set(input.key, existing.id)
    } else {
      const draftId = input.componentId ?? `__draft__${input.key}`
      index.components.set(draftId, {
        id: draftId,
        name: input.name,
        lines,
        producedQuantity: input.producedQuantity,
        producedUnit: input.producedUnit,
        rawWeight: null,
        cookedWeight: null,
        trimWasteWeight: null,
        weightUnit: null,
        storedTotalCost: 0,
        storedCostPerOutputUnit: 0,
        storedNormalizedOutputUnit: 'unit',
      })
      indexIdByKey.set(input.key, draftId)
    }
    index.componentIdByName.set(input.name.trim().toLowerCase(), indexIdByKey.get(input.key) as string)
  }

  const cache = new Map<string, CostResult>()
  for (const input of inputs) {
    const indexId = indexIdByKey.get(input.key)
    if (!indexId) continue
    const result = costComponent(indexId, index, { cache })
    out.set(input.key, outcomeFrom(result, input.clientTotalCost, input.producedQuantity, input.producedUnit))
  }
  return out
}

export interface VariantCostOutcome {
  /**
   * Null when a line could not be costed. The caller must then leave the
   * stored value alone — the same rule recalc follows, and the reason a
   * client-supplied figure is never used as a fallback here: it would put the
   * base-less total straight back.
   */
  totalCost: number | null
  serverDerived: boolean
  /** Distinct reasons the engine could not cost every line. */
  reasons: string[]
  coverage: { resolvedLines: number; totalLines: number }
}

/**
 * Costs one variant from everything that applies to it: the product's base
 * recipe, the choices in its title, its pack contents, then its own rows.
 */
export function deriveVariantCost(variantId: string, index: CostIndex): VariantCostOutcome {
  const result = costVariant(variantId, index)
  const reasons = [...new Set(result.missing.map((m) => m.reason))]
  const coverage = { resolvedLines: result.coverage.resolvedLines, totalLines: result.coverage.totalLines }
  if (result.total == null) {
    return {
      totalCost: null,
      serverDerived: false,
      reasons: reasons.length ? reasons : ['no-cost-resolved'],
      coverage,
    }
  }
  return { totalCost: result.total, serverDerived: true, reasons, coverage }
}

/**
 * Database-backed `deriveVariantCost`, for the variant save routes. Call it
 * after the row has been written, so the cost reflects what was actually
 * stored. Unlike the component path this loads the full index: a variant's
 * cost depends on its product's base recipe, the option catalogue and — for a
 * party pack — other variants.
 */
export async function computeVariantCost(
  variantId: string,
  client: PricingPrismaClient = defaultPrisma
): Promise<VariantCostOutcome> {
  const index = await buildCostIndex({ client })
  return deriveVariantCost(variantId, index)
}

/**
 * Inserts a PricePoint for every supplier link whose catalogue price just
 * changed, so manual CSV uploads build the same history the email ingestion
 * will. Silent no-op for catalogue rows that are not linked to an ingredient.
 */
export async function recordCataloguePriceChanges(
  source: string,
  rows: Array<{ sourceId: string; packPrice: number }>,
  origin: 'csv-upload' | 'email' | 'manual',
  ingestionId: string | null = null,
  client: PricingPrismaClient = defaultPrisma
): Promise<number> {
  const normalized = normalizeSource(source)
  if (!isCatalogueSource(normalized) || !rows.length) return 0

  const links = await client.ingredientSupplierLink.findMany({
    where: { source: normalized, sourceId: { in: rows.map((r) => r.sourceId) }, active: true },
    select: { id: true, sourceId: true, unitsPerPack: true, sizePerUnit: true, sizeUnit: true },
  })
  if (!links.length) return 0

  const index = await buildCostIndex({ client, includeVariants: false })
  let written = 0

  for (const link of links) {
    const row = rows.find((r) => r.sourceId === link.sourceId)
    if (!row || !Number.isFinite(row.packPrice)) continue

    const entry = index.catalogue.get(`${normalized}:${link.sourceId}`)
    const unitCost = entry?.cost?.unitCost
    if (unitCost == null) continue

    // Skip when the newest point already says the same thing, so re-uploading
    // an unchanged CSV does not pile up identical rows.
    const latest = await client.pricePoint.findFirst({
      where: { linkId: link.id },
      orderBy: { effectiveAt: 'desc' },
      select: { unitCost: true, packPrice: true },
    })
    if (latest && Math.abs(latest.unitCost - unitCost) < 1e-9 && Math.abs(latest.packPrice - row.packPrice) < 1e-9) {
      continue
    }

    await client.pricePoint.create({
      data: { linkId: link.id, packPrice: row.packPrice, unitCost, source: origin, ingestionId },
    })
    written += 1
  }
  return written
}
