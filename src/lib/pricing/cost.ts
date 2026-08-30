// The one place recipe cost math lives.
//
// Replaces nine copies of `Σ(quantity × cost)` scattered across routes and
// components, and finally uses the cycle guard that has been sitting unused in
// src/lib/components-expander.ts. Three behavioural differences from the code
// it replaces:
//
//   1. Nesting is real. A component line is costed from the child's freshly
//      computed cost per output unit, not from the stale `cost` snapshot
//      frozen into the JSON row when someone last opened the editor.
//   2. Units are checked. Multiplying a $/kg price by a quantity in 'each' is
//      reported as a gap instead of producing a number 1000x off.
//   3. Unknown is null. A component with one unresolvable line has a null
//      total and a coverage figure, never a total that quietly excludes it.
//
// There is deliberately no yield adjustment. Component.producedQuantity is the
// *final usable* output — the Components form says so on its face, and the
// parity report found no component recording both a raw and a cooked weight to
// argue otherwise. Cooking loss is therefore already inside producedQuantity,
// and dividing by cooked/(raw - trim) on top of it would charge for the same
// loss twice. rawWeight/cookedWeight/trimWasteWeight stay on Component as
// reference data for the kitchen; nothing here reads them.

import {
  CanonicalUnit,
  LegacyOutputUnit,
  convert,
  toCanonicalLoose,
  toLegacyOutputUnit,
  unitKind,
} from './units'
import {
  CostIndex,
  IndexedVariant,
  Provenance,
  RecipeLine,
  isCatalogueSource,
  normalizeSource,
  resolveCatalogueRef,
} from './resolve'

export type MissingReason =
  | 'unknown-source'
  | 'missing-ref'
  | 'unresolvable-price'
  | 'unknown-unit'
  | 'unit-kind-mismatch'
  | 'cycle'
  | 'child-cost-unknown'
  | 'no-output-quantity'

export interface MissingRef {
  ownerType: 'component' | 'variant'
  ownerId: string
  ownerName: string
  source: string
  id: string
  name: string
  reason: MissingReason
  detail?: string
}

/**
 * How the line's quantity was reconciled with the unit its price is in.
 * Only `declared` is fully evidenced; the other two are documented guesses
 * that inherit the legacy behaviour, and are counted in the parity report.
 */
export type UnitAssumption = 'declared' | 'missing-assumed' | 'unrecognised-counted'

export interface CostedLine {
  source: string
  id: string
  name: string
  quantity: number
  unit: string | null
  origin: RecipeLine['origin']
  /** Index of the row in the stored array named by `origin`. Costing never
   *  reads it; it is the only stable address an editor has, because the lines
   *  of one owner are several arrays concatenated and filtered. */
  position: number
  /** Null when the line failed before its quantity could be reconciled. */
  unitAssumption: UnitAssumption | null
  /** Line quantity expressed in the unit the resolved cost is denominated in. */
  resolvedQuantity: number | null
  unitCost: number | null
  unitCostUnit: CanonicalUnit | null
  lineCost: number | null
  provenance: Provenance | 'component' | 'variant' | null
  supplier: string | null
  confidence: number | null
  /** The row's frozen `cost`, and what the legacy formula makes of it. */
  snapshotUnitCost: number
  snapshotLineCost: number
  reason?: MissingReason
  note?: string
}

export interface CostResult {
  ownerType: 'component' | 'variant'
  ownerId: string
  ownerName: string
  /** True when every line resolved. */
  ok: boolean
  /** Batch cost, or null when any line is unknown. */
  total: number | null
  /** Sum of the lines that did resolve — always a number, for triage only. */
  partialTotal: number
  /** Cost per output unit (per variant, for variants). */
  perUnit: number | null
  /** Output unit in legacy spelling, ready to dual-write. */
  unit: LegacyOutputUnit
  canonicalUnit: CanonicalUnit
  /** Canonical output quantity — producedQuantity, which is already net of loss. */
  outputQuantity: number | null
  lines: CostedLine[]
  missing: MissingRef[]
  coverage: { resolvedLines: number; totalLines: number; pct: number }
  /** No ingredient rows at all. The sum is 0, but that is rarely a real price. */
  emptyRecipe: boolean
  /** What today's `Σ(quantity × frozen cost)` produces from the same rows. */
  snapshotTotal: number
}

export interface CostOptions {
  /** Share a cache across many costings against the same index. */
  cache?: Map<string, CostResult>
}

interface CostContext {
  index: CostIndex
  cache: Map<string, CostResult>
  stack: Set<string>
}

const COMPONENT_SOURCES = new Set(['Components'])
const VARIANT_SOURCES = new Set(['Products'])

function makeContext(index: CostIndex, opts: CostOptions | undefined): CostContext {
  return {
    index,
    cache: opts?.cache ?? new Map(),
    stack: new Set(),
  }
}

function emptyResult(
  ownerType: 'component' | 'variant',
  ownerId: string,
  ownerName: string,
  reason: MissingReason,
  detail?: string
): CostResult {
  return {
    ownerType,
    ownerId,
    ownerName,
    ok: false,
    total: null,
    partialTotal: 0,
    perUnit: null,
    unit: 'unit',
    canonicalUnit: 'each',
    outputQuantity: null,
    lines: [],
    missing: [
      { ownerType, ownerId, ownerName, source: ownerType, id: ownerId, name: ownerName, reason, detail },
    ],
    coverage: { resolvedLines: 0, totalLines: 0, pct: 0 },
    emptyRecipe: false,
    snapshotTotal: 0,
  }
}

/**
 * Line quantity -> quantity in the unit the price is denominated in.
 *
 * A blank unit means the row predates unit tracking; the legacy formula
 * multiplied straight through, so we do too and mark it. An unrecognised unit
 * against an each-priced item is still a count. Anything else that can't be
 * converted is a gap, not a guess.
 */
function resolveQuantity(
  quantity: number,
  unit: string | null,
  target: CanonicalUnit
):
  | { quantity: number; assumption: UnitAssumption; note?: string }
  | { error: MissingReason; detail: string } {
  if (!unit) {
    return {
      quantity,
      assumption: 'missing-assumed',
      note: 'no unit on row; assumed already in ' + target,
    }
  }
  const kind = unitKind(unit)
  if (kind === null) {
    if (target === 'each') {
      return { quantity, assumption: 'unrecognised-counted', note: `unrecognised unit '${unit}' counted as each` }
    }
    return { error: 'unknown-unit', detail: `unit '${unit}' is not a mass, volume, or count` }
  }
  const converted = convert(quantity, unit, target)
  if (converted == null) {
    return { error: 'unit-kind-mismatch', detail: `cannot convert '${unit}' to '${target}'` }
  }
  return { quantity: converted, assumption: 'declared' }
}

function costLine(line: RecipeLine, owner: { type: 'component' | 'variant'; id: string; name: string }, ctx: CostContext): {
  line: CostedLine
  missing: MissingRef[]
} {
  const snapshotLineCost = line.quantity * line.snapshotCost
  const base: CostedLine = {
    source: line.source,
    id: line.id,
    name: line.name,
    quantity: line.quantity,
    unit: line.unit,
    origin: line.origin,
    position: line.position,
    unitAssumption: null,
    resolvedQuantity: null,
    unitCost: null,
    unitCostUnit: null,
    lineCost: null,
    provenance: null,
    supplier: null,
    confidence: null,
    snapshotUnitCost: line.snapshotCost,
    snapshotLineCost,
  }

  const fail = (reason: MissingReason, detail?: string): { line: CostedLine; missing: MissingRef[] } => ({
    line: { ...base, reason, note: detail },
    missing: [
      {
        ownerType: owner.type,
        ownerId: owner.id,
        ownerName: owner.name,
        source: line.source,
        id: line.id,
        name: line.name,
        reason,
        detail,
      },
    ],
  })

  let unitCost: number | null = null
  let unitCostUnit: CanonicalUnit | null = null
  let provenance: CostedLine['provenance'] = null
  let supplier: string | null = null
  let confidence: number | null = null
  let note: string | undefined
  const inherited: MissingRef[] = []

  // Phase 2: a stamped ingredientId wins over the legacy (source, id) pair.
  const mastered = line.ingredientId ? ctx.index.ingredientCosts.get(line.ingredientId) : undefined
  const source = normalizeSource(line.source)

  if (mastered) {
    unitCost = mastered.unitCost
    unitCostUnit = mastered.unit
    provenance = mastered.provenance
    supplier = mastered.supplier
    confidence = mastered.confidence
  } else if (!source) {
    return fail('unknown-source', `source '${line.source}' is not a known ingredient source`)
  } else if (COMPONENT_SOURCES.has(source)) {
    const childId =
      ctx.index.components.has(line.id) ? line.id : ctx.index.componentIdByName.get(line.name.trim().toLowerCase())
    if (!childId) return fail('missing-ref', `no component with id '${line.id}' or name '${line.name}'`)
    if (!ctx.index.components.has(line.id)) note = 'component matched by name, not id'

    const child = costComponentInternal(childId, ctx)
    inherited.push(...child.missing)
    if (child.perUnit == null) {
      const detail = child.missing.some((m) => m.reason === 'cycle')
        ? `component '${child.ownerName}' is part of a reference cycle`
        : `component '${child.ownerName}' has no resolvable cost per unit`
      return {
        line: { ...base, reason: 'child-cost-unknown', note: detail, provenance: 'component' },
        missing: [
          {
            ownerType: owner.type,
            ownerId: owner.id,
            ownerName: owner.name,
            source: line.source,
            id: line.id,
            name: line.name,
            reason: 'child-cost-unknown',
            detail,
          },
          ...inherited,
        ],
      }
    }
    unitCost = child.perUnit
    unitCostUnit = child.canonicalUnit
    provenance = 'component'
    supplier = 'Components'
    confidence = 1
  } else if (VARIANT_SOURCES.has(source)) {
    const variant = resolveVariantRef(line, ctx)
    if (!variant.variant) return fail('missing-ref', variant.detail)
    if (variant.note) note = variant.note

    const child = costVariantInternal(variant.variant, ctx)
    inherited.push(...child.missing)
    if (child.total == null) {
      return {
        line: { ...base, reason: 'child-cost-unknown', note: `variant '${child.ownerName}' has no resolvable cost`, provenance: 'variant' },
        missing: [
          {
            ownerType: owner.type,
            ownerId: owner.id,
            ownerName: owner.name,
            source: line.source,
            id: line.id,
            name: line.name,
            reason: 'child-cost-unknown',
            detail: `variant '${child.ownerName}' has no resolvable cost`,
          },
          ...inherited,
        ],
      }
    }
    unitCost = child.total
    unitCostUnit = 'each'
    provenance = 'variant'
    supplier = 'Products'
    confidence = 1
  } else if (isCatalogueSource(source)) {
    const match = resolveCatalogueRef(ctx.index, source, line.id, line.name)
    if (!match) return fail('missing-ref', `no ${source} row with id '${line.id}'`)
    if (match.matchedBy === 'name') note = `${source} row matched by name, not id`
    if (!match.entry.cost) {
      return fail('unresolvable-price', `${source} '${match.entry.name}': ${match.entry.reason ?? 'no price'}`)
    }
    unitCost = match.entry.cost.unitCost
    unitCostUnit = match.entry.cost.unit
    provenance = match.entry.cost.provenance
    supplier = match.entry.cost.supplier
    confidence = match.entry.cost.confidence
  } else {
    return fail('unknown-source', `source '${line.source}' is not costable`)
  }

  if (unitCost == null || unitCostUnit == null) {
    return fail('unresolvable-price', 'no unit cost resolved')
  }

  const quantity = resolveQuantity(line.quantity, line.unit, unitCostUnit)
  if ('error' in quantity) {
    const failure = fail(quantity.error, quantity.detail)
    return {
      line: { ...failure.line, unitCost, unitCostUnit, provenance, supplier, confidence },
      missing: [...failure.missing, ...inherited],
    }
  }

  return {
    line: {
      ...base,
      unitAssumption: quantity.assumption,
      resolvedQuantity: quantity.quantity,
      unitCost,
      unitCostUnit,
      lineCost: quantity.quantity * unitCost,
      provenance,
      supplier,
      confidence,
      note: note ?? quantity.note,
    },
    missing: inherited,
  }
}

function resolveVariantRef(
  line: RecipeLine,
  ctx: CostContext
): { variant: IndexedVariant | null; note?: string; detail: string } {
  const byVariantId = ctx.index.variantsByVariantId.get(line.id)
  if (byVariantId) return { variant: byVariantId, detail: '' }

  const byPk = ctx.index.variantsById.get(line.id)
  if (byPk) return { variant: byPk, note: 'matched by variant row id, not Shopify variant id', detail: '' }

  // ProductsTab stores a ShopifyProduct id here (a long-standing bug). Usable
  // only when the product has exactly one variant.
  const siblings = ctx.index.variantIdsByProductId.get(line.id)
  if (siblings?.length === 1) {
    const variant = ctx.index.variantsByVariantId.get(siblings[0])
    if (variant) {
      return { variant, note: 'reference is a product id; product has a single variant', detail: '' }
    }
  }
  if (siblings && siblings.length > 1) {
    return {
      variant: null,
      detail: `reference is a product id with ${siblings.length} variants; cannot pick one`,
    }
  }
  return { variant: null, detail: `no variant with id '${line.id}'` }
}

function assemble(
  ownerType: 'component' | 'variant',
  ownerId: string,
  ownerName: string,
  lines: RecipeLine[],
  ctx: CostContext
): { costed: CostedLine[]; missing: MissingRef[]; total: number | null; partialTotal: number; snapshotTotal: number; resolvedLines: number } {
  const costed: CostedLine[] = []
  const missing: MissingRef[] = []
  let partialTotal = 0
  let snapshotTotal = 0
  let resolvedLines = 0
  let complete = true

  for (const line of lines) {
    const result = costLine(line, { type: ownerType, id: ownerId, name: ownerName }, ctx)
    costed.push(result.line)
    snapshotTotal += result.line.snapshotLineCost
    if (result.line.lineCost == null) {
      complete = false
    } else {
      partialTotal += result.line.lineCost
      resolvedLines += 1
    }
    for (const ref of result.missing) missing.push(ref)
  }

  return {
    costed,
    missing,
    total: complete ? partialTotal : null,
    partialTotal,
    snapshotTotal,
    resolvedLines,
  }
}

function costComponentInternal(componentId: string, ctx: CostContext): CostResult {
  const key = `component:${componentId}`
  const cached = ctx.cache.get(key)
  if (cached) return cached

  const component = ctx.index.components.get(componentId)
  if (!component) {
    return emptyResult('component', componentId, componentId, 'missing-ref', 'component not in index')
  }

  if (ctx.stack.has(key)) {
    // The guard src/lib/components-expander.ts has carried since it was written
    // and never used. Returning an unknown cost (rather than recursing) makes a
    // cycle terminate and show up in the report instead of hanging the process.
    return emptyResult(
      'component',
      componentId,
      component.name,
      'cycle',
      `component '${component.name}' references itself through ${[...ctx.stack].join(' -> ')}`
    )
  }

  ctx.stack.add(key)
  const assembled = assemble('component', componentId, component.name, component.lines, ctx)
  ctx.stack.delete(key)

  const output = toCanonicalLoose(component.producedQuantity, component.producedUnit)
  const outputQuantity = output.qty

  const missing = [...assembled.missing]
  let perUnit: number | null = null
  if (assembled.total != null) {
    if (outputQuantity > 0) {
      perUnit = assembled.total / outputQuantity
    } else {
      missing.push({
        ownerType: 'component',
        ownerId: componentId,
        ownerName: component.name,
        source: 'Components',
        id: componentId,
        name: component.name,
        reason: 'no-output-quantity',
        detail: `producedQuantity ${component.producedQuantity} ${component.producedUnit} is not positive`,
      })
    }
  }

  const totalLines = component.lines.length
  const result: CostResult = {
    ownerType: 'component',
    ownerId: componentId,
    ownerName: component.name,
    ok: assembled.total != null && perUnit != null,
    total: assembled.total,
    partialTotal: assembled.partialTotal,
    perUnit,
    unit: toLegacyOutputUnit(output.unit),
    canonicalUnit: output.unit,
    outputQuantity: outputQuantity > 0 ? outputQuantity : null,
    lines: assembled.costed,
    missing,
    coverage: {
      resolvedLines: assembled.resolvedLines,
      totalLines,
      pct: totalLines === 0 ? 1 : assembled.resolvedLines / totalLines,
    },
    emptyRecipe: totalLines === 0,
    snapshotTotal: assembled.snapshotTotal,
  }

  // A result reached through a cycle is context-dependent; caching it would
  // poison every later lookup of the same component.
  if (!missing.some((m) => m.reason === 'cycle')) ctx.cache.set(key, result)
  return result
}

function costVariantInternal(variant: IndexedVariant, ctx: CostContext): CostResult {
  const key = `variant:${variant.variantId}`
  const cached = ctx.cache.get(key)
  if (cached) return cached

  if (ctx.stack.has(key)) {
    return emptyResult(
      'variant',
      variant.variantId,
      variant.name,
      'cycle',
      `variant '${variant.name}' references itself through ${[...ctx.stack].join(' -> ')}`
    )
  }

  ctx.stack.add(key)
  const assembled = assemble('variant', variant.variantId, variant.name, variant.lines, ctx)
  ctx.stack.delete(key)

  const totalLines = variant.lines.length
  const result: CostResult = {
    ownerType: 'variant',
    ownerId: variant.variantId,
    ownerName: variant.name,
    ok: assembled.total != null,
    total: assembled.total,
    partialTotal: assembled.partialTotal,
    perUnit: assembled.total,
    unit: 'unit',
    canonicalUnit: 'each',
    outputQuantity: 1,
    lines: assembled.costed,
    missing: assembled.missing,
    coverage: {
      resolvedLines: assembled.resolvedLines,
      totalLines,
      pct: totalLines === 0 ? 1 : assembled.resolvedLines / totalLines,
    },
    emptyRecipe: totalLines === 0,
    snapshotTotal: assembled.snapshotTotal,
  }

  if (!assembled.missing.some((m) => m.reason === 'cycle')) ctx.cache.set(key, result)
  return result
}

export function costComponent(componentId: string, index: CostIndex, opts?: CostOptions): CostResult {
  return costComponentInternal(componentId, makeContext(index, opts))
}

export function costVariant(variantId: string, index: CostIndex, opts?: CostOptions): CostResult {
  const variant = index.variantsByVariantId.get(variantId) ?? index.variantsById.get(variantId)
  if (!variant) return emptyResult('variant', variantId, variantId, 'missing-ref', 'variant not in index')
  return costVariantInternal(variant, makeContext(index, opts))
}

export interface MarginResult {
  rrpEx: number
  rrpInclGst: number
  margin: number | null
  targetRrpEx: number | null
  targetRrpInclGst: number | null
}

export function marginFor(
  cost: number | null,
  shopifyPriceInclGst: number,
  gstRate = 0.15,
  target = 0.7
): MarginResult {
  const rrpInclGst = Number.isFinite(shopifyPriceInclGst) ? shopifyPriceInclGst : 0
  const rrpEx = rrpInclGst / (1 + gstRate)
  if (cost == null || !Number.isFinite(cost)) {
    return { rrpEx, rrpInclGst, margin: null, targetRrpEx: null, targetRrpInclGst: null }
  }
  const margin = rrpEx > 0 ? (rrpEx - cost) / rrpEx : null
  const targetRrpEx = target < 1 ? cost / (1 - target) : null
  return {
    rrpEx,
    rrpInclGst,
    margin,
    targetRrpEx,
    targetRrpInclGst: targetRrpEx == null ? null : targetRrpEx * (1 + gstRate),
  }
}

/**
 * Components in dependency order: anything used by another component is
 * costed first. Components caught in a cycle are appended last so a recalc
 * still visits them (and reports the cycle) instead of dropping them.
 */
export function topoSortComponents(index: CostIndex): { order: string[]; cyclic: string[] } {
  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()

  for (const [id, component] of index.components) {
    if (!dependencies.has(id)) dependencies.set(id, new Set())
    for (const line of component.lines) {
      if (normalizeSource(line.source) !== 'Components') continue
      const childId = index.components.has(line.id)
        ? line.id
        : index.componentIdByName.get(line.name.trim().toLowerCase())
      if (!childId || childId === id) continue
      dependencies.get(id)!.add(childId)
      const bucket = dependents.get(childId)
      if (bucket) bucket.add(id)
      else dependents.set(childId, new Set([id]))
    }
  }

  const remaining = new Map<string, number>()
  for (const [id, deps] of dependencies) remaining.set(id, deps.size)

  const queue = [...remaining.entries()].filter(([, count]) => count === 0).map(([id]) => id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift() as string
    order.push(id)
    for (const parent of dependents.get(id) ?? []) {
      const count = (remaining.get(parent) ?? 0) - 1
      remaining.set(parent, count)
      if (count === 0) queue.push(parent)
    }
  }

  const visited = new Set(order)
  const cyclic = [...index.components.keys()].filter((id) => !visited.has(id))
  return { order: [...order, ...cyclic], cyclic }
}
