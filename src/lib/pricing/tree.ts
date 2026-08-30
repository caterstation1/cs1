// The costed, expandable recipe tree the Recipe Builder renders.
//
// costComponent/costVariant return one flat level of costed lines. The builder
// needs the whole nesting, with each row carrying where its price came from —
// so this walks the tree, reusing the engine's per-level results rather than
// recomputing anything.

import { prisma as defaultPrisma } from '../prisma'
import { CostResult, CostedLine, costComponent, costVariant, marginFor } from './cost'
import { CostIndex, normalizeSource } from './resolve'

export type OwnerType = 'product' | 'component'

export interface TreeNode {
  /** Stable path within this tree, e.g. "r0-2". The React key only — a path is
   *  a position in the rendered tree, which is not where the row is stored. */
  path: string
  kind: 'ingredient' | 'component'
  source: string
  refId: string
  /** Which of the owner's arrays the row came from, and its index in that
   *  array as stored. Together these are the address a line edit must use:
   *  an owner's lines are `baseIngredients`, the title's options, the pack
   *  contents and the owner's own rows concatenated and de-duplicated, so a
   *  row's rendered position says nothing about where it lives. */
  origin: CostedLine['origin']
  position: number
  /** Component rows: the actual Component.id the ref resolved to (legacy rows
   *  sometimes point by name). This is the id line edits must be sent to. */
  resolvedComponentId?: string | null
  ingredientId: string | null
  name: string
  quantity: number
  unit: string | null
  unitCost: number | null
  unitCostUnit: string | null
  lineCost: number | null
  supplier: string | null
  provenance: string | null
  confidence: number | null
  /** Set when the line could not be costed. */
  reason: string | null
  note: string | null
  /** Component rows only. */
  batchCost?: number | null
  producedQuantity?: number
  producedUnit?: string
  children?: TreeNode[]
}

export interface RecipeSummary {
  ownerType: OwnerType
  id: string
  name: string
  subtitle: string
  totalCost: number | null
  partialTotal: number
  /** Products only. */
  serves?: number | null
  costPerServe?: number | null
  rrpInclGst?: number | null
  rrpEx?: number | null
  margin?: number | null
  targetMargin?: number
  targetRrpEx?: number | null
  targetRrpInclGst?: number | null
  /** Components only. */
  batchCost?: number | null
  perUnit?: number | null
  producedQuantity?: number
  producedUnit?: string
  coverage: { resolvedLines: number; totalLines: number; pct: number }
  reasons: string[]
}

export interface DietaryRollup {
  key: string
  label: string
  present: boolean
  /** Ingredients contributing the flag, for the tooltip. */
  from: string[]
}

export interface RecipeTree {
  summary: RecipeSummary
  nodes: TreeNode[]
  dietary: DietaryRollup[]
  /** Populated for components: products whose tree reaches this component. */
  usedIn: Array<{ id: string; name: string; margin: number | null }>
}

const DIETARY_FIELDS = [
  { key: 'hasGluten', label: 'Gluten' },
  { key: 'hasDairy', label: 'Dairy' },
  { key: 'hasNuts', label: 'Nuts' },
  { key: 'hasEgg', label: 'Egg' },
  { key: 'hasSoy', label: 'Soy' },
  { key: 'hasSesame', label: 'Sesame' },
  { key: 'hasOnionGarlic', label: 'Onion/Garlic' },
] as const

export type DietaryFlagKey = (typeof DIETARY_FIELDS)[number]['key']

/** The Ingredient columns the dietary rollup reads. */
export type IngredientFlags = { name: string } & Record<DietaryFlagKey, boolean>

/** Allergen flags for every active ingredient, keyed by id. */
export async function loadIngredientFlags(
  client: Pick<typeof defaultPrisma, 'ingredient'> = defaultPrisma
): Promise<Map<string, IngredientFlags>> {
  const rows = await client.ingredient.findMany({
    where: { status: 'active' },
    select: {
      id: true, name: true,
      hasGluten: true, hasDairy: true, hasNuts: true, hasEgg: true,
      hasSoy: true, hasSesame: true, hasOnionGarlic: true,
    },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

function nodeFromLine(line: CostedLine, path: string): TreeNode {
  const source = normalizeSource(line.source)
  return {
    path,
    kind: source === 'Components' ? 'component' : 'ingredient',
    source: line.source,
    refId: line.id,
    origin: line.origin,
    position: line.position,
    ingredientId: null,
    name: line.name,
    quantity: line.quantity,
    unit: line.unit,
    unitCost: line.unitCost,
    unitCostUnit: line.unitCostUnit,
    lineCost: line.lineCost,
    supplier: line.supplier,
    provenance: line.provenance,
    confidence: line.confidence,
    reason: line.reason ?? null,
    note: line.note ?? null,
  }
}

/** Resolves a `Components` line to the component it actually points at. */
function childComponentId(index: CostIndex, refId: string, name: string): string | null {
  if (index.components.has(refId)) return refId
  return index.componentIdByName.get(name.trim().toLowerCase()) ?? null
}

function expand(
  lines: CostedLine[],
  index: CostIndex,
  cache: Map<string, CostResult>,
  prefix: string,
  depth: number,
  stack: Set<string>
): TreeNode[] {
  return lines.map((line, i) => {
    const path = prefix ? `${prefix}-${i}` : `r${i}`
    const node = nodeFromLine(line, path)
    if (node.kind !== 'component') return node

    const childId = childComponentId(index, line.id, line.name)
    if (!childId) return node
    const child = index.components.get(childId)
    if (!child) return node

    node.resolvedComponentId = childId
    node.producedQuantity = child.producedQuantity
    node.producedUnit = child.producedUnit

    // Depth cap and cycle guard: a self-referencing recipe must not expand
    // forever. The engine already reports the cycle; here it just stops.
    if (stack.has(childId) || depth >= 8) {
      node.children = []
      return node
    }

    const childResult = costComponent(childId, index, { cache })
    node.batchCost = childResult.total
    stack.add(childId)
    node.children = expand(childResult.lines, index, cache, path, depth + 1, stack)
    stack.delete(childId)
    return node
  })
}

/** Every ingredientId reachable through the tree, for the dietary rollup. */
function collectIngredientIds(nodes: TreeNode[], into: Set<string>) {
  for (const node of nodes) {
    if (node.ingredientId) into.add(node.ingredientId)
    if (node.children) collectIngredientIds(node.children, into)
  }
}

/** Stamps ingredientId onto nodes from the recipe rows behind them. */
function applyIngredientIds(nodes: TreeNode[], index: CostIndex, ownerLines: Map<string, string | null>) {
  for (const node of nodes) {
    const key = `${node.source}:${node.refId}`
    node.ingredientId = ownerLines.get(key) ?? null
    if (node.children) applyIngredientIds(node.children, index, ownerLines)
  }
}

function buildIngredientIdLookup(index: CostIndex): Map<string, string | null> {
  const map = new Map<string, string | null>()
  for (const component of index.components.values()) {
    for (const line of component.lines) map.set(`${line.source}:${line.id}`, line.ingredientId)
  }
  for (const variant of index.variantsByVariantId.values()) {
    for (const line of variant.lines) map.set(`${line.source}:${line.id}`, line.ingredientId)
  }
  return map
}

export interface BuildTreeOptions {
  /** Ingredient flags, keyed by Ingredient.id. */
  ingredientFlags?: Map<string, IngredientFlags>
  serves?: number | null
  cache?: Map<string, CostResult>
}

export function buildRecipeTree(
  ownerType: OwnerType,
  ownerId: string,
  index: CostIndex,
  options: BuildTreeOptions = {}
): RecipeTree | null {
  const cache = options.cache ?? new Map<string, CostResult>()

  let result: CostResult
  let summary: RecipeSummary

  if (ownerType === 'component') {
    const component = index.components.get(ownerId)
    if (!component) return null
    result = costComponent(ownerId, index, { cache })
    summary = {
      ownerType,
      id: ownerId,
      name: component.name,
      subtitle: `Component · batch yields ${component.producedQuantity} ${component.producedUnit}`,
      totalCost: result.total,
      partialTotal: result.partialTotal,
      batchCost: result.total,
      perUnit: result.perUnit,
      producedQuantity: component.producedQuantity,
      producedUnit: component.producedUnit,
      coverage: result.coverage,
      reasons: [...new Set(result.missing.map((m) => m.reason))],
    }
  } else {
    const variant = index.variantsByVariantId.get(ownerId) ?? index.variantsById.get(ownerId)
    if (!variant) return null
    result = costVariant(variant.variantId, index, { cache })
    const targetMargin = index.settings.targetMargin
    const m = marginFor(result.total, variant.shopifyPriceInclGst, index.settings.gstRate, targetMargin)
    const serves = options.serves ?? null
    summary = {
      ownerType,
      id: variant.variantId,
      name: variant.name,
      subtitle:
        `Sellable product${serves ? ` · serves ${serves}` : ''} · ` +
        `RRP $${variant.shopifyPriceInclGst.toFixed(2)} incl GST`,
      totalCost: result.total,
      partialTotal: result.partialTotal,
      serves,
      costPerServe: result.total != null && serves ? result.total / serves : null,
      rrpInclGst: variant.shopifyPriceInclGst,
      rrpEx: m.rrpEx,
      margin: m.margin,
      targetMargin,
      targetRrpEx: m.targetRrpEx,
      targetRrpInclGst: m.targetRrpInclGst,
      coverage: result.coverage,
      reasons: [...new Set(result.missing.map((m) => m.reason))],
    }
  }

  const nodes = expand(result.lines, index, cache, '', 0, new Set(ownerType === 'component' ? [ownerId] : []))
  applyIngredientIds(nodes, index, buildIngredientIdLookup(index))

  // Dietary is derived for display only. The manual Component booleans are not
  // touched, and disagreement is surfaced rather than resolved.
  const ingredientIds = new Set<string>()
  collectIngredientIds(nodes, ingredientIds)
  const dietary: DietaryRollup[] = DIETARY_FIELDS.map((field) => {
    const from: string[] = []
    for (const id of ingredientIds) {
      const flags = options.ingredientFlags?.get(id)
      if (flags?.[field.key]) from.push(flags.name)
    }
    return { key: field.key, label: field.label, present: from.length > 0, from }
  })

  const usedIn =
    ownerType === 'component'
      ? productsUsingComponent(ownerId, index, cache).map((v) => {
          const r = costVariant(v.variantId, index, { cache })
          return {
            id: v.variantId,
            name: v.name,
            margin: marginFor(r.total, v.shopifyPriceInclGst, index.settings.gstRate, index.settings.targetMargin)
              .margin,
          }
        })
      : []

  return { summary, nodes, dietary, usedIn }
}

/** Reverse index: variants whose recipe reaches this component at any depth. */
export function productsUsingComponent(componentId: string, index: CostIndex, cache?: Map<string, CostResult>) {
  const reaches = (lines: { source: string; id: string; name: string }[], seen: Set<string>): boolean => {
    for (const line of lines) {
      if (normalizeSource(line.source) !== 'Components') continue
      const childId = childComponentId(index, line.id, line.name)
      if (!childId || seen.has(childId)) continue
      if (childId === componentId) return true
      seen.add(childId)
      const child = index.components.get(childId)
      if (child && reaches(child.lines, seen)) return true
    }
    return false
  }

  const out = []
  for (const variant of index.variantsByVariantId.values()) {
    if (reaches(variant.lines, new Set())) out.push(variant)
  }
  return out
}
