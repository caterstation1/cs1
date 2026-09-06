// Whole-catalogue repricing.
//
// Nothing calls this yet — wiring the triggers (component save, variant save,
// supplier uploads, nightly cron, the existing recalculate-costs route) is
// Phase 4. It exists now so the engine is complete and testable.
//
// Differences from src/app/api/products/recalculate-costs/route.ts, which it
// eventually replaces:
//   - Components are repriced at all. The current route only touches
//     ProductVariant, so any component built from supplier items is frozen at
//     whatever the price was when someone last saved it.
//   - Components are processed in dependency order, so a parent sees its
//     children's new costs in the same run.
//   - One cost index instead of a findUnique per ingredient per variant.
//   - An unresolved cost leaves the stored value alone and is reported. The
//     current route writes 0, which makes margins improve when a supplier row
//     is deleted.

import { prisma as defaultPrisma } from '../prisma'
import { CostResult, MissingRef, costComponent, costVariant, topoSortComponents } from './cost'
import { CostIndex, buildCostIndex } from './resolve'

const CHANGE_EPSILON = 1e-6

export interface ComponentWrite {
  totalCost: number
  costPerOutputUnit: number
  normalizedOutputUnit: string
}

export interface VariantWrite {
  totalCost: number
}

export interface RecalcRunInput {
  trigger: string
  startedAt: Date
  durationMs: number
  componentsUpdated: number
  variantsUpdated: number
  coveragePct: number
  missing: MissingRef[]
}

export interface RecalcStore {
  buildIndex(): Promise<CostIndex>
  updateComponent(id: string, data: ComponentWrite): Promise<void>
  /** Keyed by ProductVariant.id (the primary key), not the Shopify variant id. */
  updateVariant(id: string, data: VariantWrite): Promise<void>
  /** Returns the RecalcRun id; null when the store doesn't record runs. */
  persistRun(input: RecalcRunInput): Promise<string | null>
}

export interface ComponentChange {
  id: string
  name: string
  totalCostBefore: number
  totalCostAfter: number
  perUnitBefore: number
  perUnitAfter: number
  unitBefore: string
  unitAfter: string
}

export interface VariantChange {
  id: string
  variantId: string
  name: string
  totalCostBefore: number
  totalCostAfter: number
}

export interface UnresolvedEntry {
  type: 'component' | 'variant'
  id: string
  name: string
  storedCost: number
  resolvedLines: number
  totalLines: number
  reasons: string[]
}

export interface RecalcReport {
  trigger: string
  startedAt: Date
  durationMs: number
  dryRun: boolean
  components: { total: number; costed: number; updated: number; unresolved: number }
  variants: { total: number; costed: number; updated: number; unresolved: number }
  coveragePct: number
  componentChanges: ComponentChange[]
  variantChanges: VariantChange[]
  unresolved: UnresolvedEntry[]
  missing: MissingRef[]
  cyclicComponentIds: string[]
  runId: string | null
  warnings: string[]
}

export interface RecalcOptions {
  dryRun?: boolean
  store?: RecalcStore
  index?: CostIndex
  /** Cap on missing refs carried in the report. Defaults to 500. */
  maxMissing?: number
}

export function createPrismaRecalcStore(client: typeof defaultPrisma = defaultPrisma): RecalcStore {
  const db = client
  return {
    buildIndex: () => buildCostIndex({ client: db }),
    async updateComponent(id, data) {
      await db.component.update({ where: { id }, data })
    },
    async updateVariant(id, data) {
      await db.productVariant.update({ where: { id }, data })
    },
    async persistRun(input) {
      const row = await db.recalcRun.create({
        data: {
          trigger: input.trigger,
          startedAt: input.startedAt,
          durationMs: Math.round(input.durationMs),
          componentsUpdated: input.componentsUpdated,
          variantsUpdated: input.variantsUpdated,
          coveragePct: input.coveragePct,
          // Spelled out rather than cast: this column is an audit record the
          // digest reads back later, so its shape shouldn't silently follow
          // whatever MissingRef happens to look like at the time.
          missing: input.missing.map((ref) => ({
            ownerType: ref.ownerType,
            ownerId: ref.ownerId,
            ownerName: ref.ownerName,
            source: ref.source,
            id: ref.id,
            name: ref.name,
            reason: ref.reason,
            detail: ref.detail ?? null,
          })),
        },
      })
      return row.id
    },
  }
}

function changed(a: number, b: number): boolean {
  return Math.abs(a - b) > CHANGE_EPSILON
}

function unresolvedEntry(
  type: 'component' | 'variant',
  result: CostResult,
  storedCost: number
): UnresolvedEntry {
  const reasons = [...new Set(result.missing.map((m) => m.reason))]
  return {
    type,
    id: result.ownerId,
    name: result.ownerName,
    storedCost,
    resolvedLines: result.coverage.resolvedLines,
    totalLines: result.coverage.totalLines,
    reasons,
  }
}

export async function recalcAll(trigger: string, opts: RecalcOptions = {}): Promise<RecalcReport> {
  const startedAt = new Date()
  const startedMs = Date.now()
  const dryRun = opts.dryRun ?? false
  const maxMissing = opts.maxMissing ?? 500
  const store = opts.store ?? createPrismaRecalcStore()
  const warnings: string[] = []

  const index = opts.index ?? (await store.buildIndex())

  // Shared across both passes so a component is costed once no matter how many
  // parents and variants reference it.
  const cache = new Map<string, CostResult>()
  const costOpts = { cache }

  const componentChanges: ComponentChange[] = []
  const variantChanges: VariantChange[] = []
  const unresolved: UnresolvedEntry[] = []
  const missing: MissingRef[] = []
  let resolvedLines = 0
  let totalLines = 0
  let componentsCosted = 0
  let variantsCosted = 0

  const { order, cyclic } = topoSortComponents(index)
  if (cyclic.length) {
    warnings.push(`${cyclic.length} component(s) are part of a reference cycle and cannot be costed.`)
  }

  for (const componentId of order) {
    const component = index.components.get(componentId)
    if (!component) continue
    const result = costComponent(componentId, index, costOpts)
    resolvedLines += result.coverage.resolvedLines
    totalLines += result.coverage.totalLines
    for (const ref of result.missing) if (missing.length < maxMissing) missing.push(ref)

    if (result.total == null || result.perUnit == null) {
      unresolved.push(unresolvedEntry('component', result, component.storedTotalCost))
      continue
    }
    // A recipe with no rows sums to 0, which is almost never a real price.
    // Overwriting a known cost with it is the failure mode this engine exists
    // to stop, so it is reported instead.
    if (result.emptyRecipe && component.storedTotalCost > 0) {
      unresolved.push({ ...unresolvedEntry('component', result, component.storedTotalCost), reasons: ['empty-recipe'] })
      continue
    }
    componentsCosted += 1

    const write: ComponentWrite = {
      totalCost: result.total,
      costPerOutputUnit: result.perUnit,
      normalizedOutputUnit: result.unit,
    }
    const isDifferent =
      changed(component.storedTotalCost, write.totalCost) ||
      changed(component.storedCostPerOutputUnit, write.costPerOutputUnit) ||
      component.storedNormalizedOutputUnit !== write.normalizedOutputUnit
    if (!isDifferent) continue

    componentChanges.push({
      id: componentId,
      name: component.name,
      totalCostBefore: component.storedTotalCost,
      totalCostAfter: write.totalCost,
      perUnitBefore: component.storedCostPerOutputUnit,
      perUnitAfter: write.costPerOutputUnit,
      unitBefore: component.storedNormalizedOutputUnit,
      unitAfter: write.normalizedOutputUnit,
    })

    if (!dryRun) await store.updateComponent(componentId, write)
    // Keep the index consistent with what was just written so the report and
    // any second pass in the same process see the new values.
    component.storedTotalCost = write.totalCost
    component.storedCostPerOutputUnit = write.costPerOutputUnit
    component.storedNormalizedOutputUnit = write.normalizedOutputUnit
  }

  for (const variant of index.variantsByVariantId.values()) {
    const result = costVariant(variant.variantId, index, costOpts)
    resolvedLines += result.coverage.resolvedLines
    totalLines += result.coverage.totalLines
    for (const ref of result.missing) if (missing.length < maxMissing) missing.push(ref)

    if (result.total == null) {
      unresolved.push(unresolvedEntry('variant', result, variant.storedTotalCost))
      continue
    }
    if (result.emptyRecipe && variant.storedTotalCost > 0) {
      unresolved.push({ ...unresolvedEntry('variant', result, variant.storedTotalCost), reasons: ['empty-recipe'] })
      continue
    }
    variantsCosted += 1

    if (!changed(variant.storedTotalCost, result.total)) continue

    variantChanges.push({
      id: variant.id,
      variantId: variant.variantId,
      name: variant.name,
      totalCostBefore: variant.storedTotalCost,
      totalCostAfter: result.total,
    })

    if (!dryRun) await store.updateVariant(variant.id, { totalCost: result.total })
    variant.storedTotalCost = result.total
  }

  const durationMs = Date.now() - startedMs
  const coveragePct = totalLines === 0 ? 1 : resolvedLines / totalLines

  let runId: string | null = null
  if (!dryRun) {
    runId = await store.persistRun({
      trigger,
      startedAt,
      durationMs,
      componentsUpdated: componentChanges.length,
      variantsUpdated: variantChanges.length,
      coveragePct,
      missing,
    })
    if (runId == null) warnings.push('This run was not recorded: the store does not persist RecalcRun rows.')
  }

  return {
    trigger,
    startedAt,
    durationMs,
    dryRun,
    components: {
      total: index.components.size,
      costed: componentsCosted,
      updated: componentChanges.length,
      unresolved: unresolved.filter((u) => u.type === 'component').length,
    },
    variants: {
      total: index.variantsByVariantId.size,
      costed: variantsCosted,
      updated: variantChanges.length,
      unresolved: unresolved.filter((u) => u.type === 'variant').length,
    },
    coveragePct,
    componentChanges,
    variantChanges,
    unresolved,
    missing,
    cyclicComponentIds: cyclic,
    runId,
    warnings,
  }
}
