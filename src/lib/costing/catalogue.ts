// The costing screen's read model: every option, how much of the shop depends
// on it, and — when it has no recipe yet — which existing components look like
// what it should carry.

import { prisma } from '@/lib/prisma'
import { splitParts } from '@/lib/variant-part-edit'
import { aliasKey, normalizeOptionKey, normalizeRows, type RecipeRow } from './options'

export interface OptionSuggestion {
  source: 'Components'
  id: string
  name: string
  cost: number
}

export interface OptionSummary {
  id: string
  name: string
  kind: string
  items: RecipeRow[]
  noIngredients: boolean
  notes: string | null
  aliases: string[]
  /** Variants whose title contains this option, via any of its spellings. */
  variantCount: number
  /** Distinct products offering it. */
  productCount: number
  /** Components whose name looks like this option, for the uncosted ones. */
  suggestions: OptionSuggestion[]
  /**
   * Costed options that look like the same thing under a different spelling.
   * "Roasted Lamb (+$25)" and "Roasted Lamb (DF) (GF) (H)" are one choice as
   * far as the kitchen is concerned, and folding is better than costing twice.
   */
  foldCandidates: Array<{ id: string; name: string; portionCost: number; variantCount: number }>
  /** Unit cost of one portion at current component prices. */
  portionCost: number
}

export interface UnassignedSegment {
  value: string
  variantCount: number
  suggestions: OptionSuggestion[]
  /** An existing option this spelling probably belongs to. */
  likelyOption: { id: string; name: string } | null
}

export interface CostingCatalogue {
  options: OptionSummary[]
  unassigned: UnassignedSegment[]
  /** An option has been edited since the last reprice, so stored costs are stale. */
  repriceNeeded: boolean
  totals: {
    variants: number
    spellings: number
    options: number
    uncostedOptions: number
    variantChoicesUncosted: number
  }
}

function tokens(value: string): Set<string> {
  return new Set(normalizeOptionKey(value).split(' ').filter(Boolean))
}

function shared(a: Set<string>, b: Set<string>): number {
  let hits = 0
  a.forEach((t) => {
    if (b.has(t)) hits++
  })
  return hits
}

/**
 * How much of the shorter name the longer one covers. Deliberately lenient,
 * because a component is expected to be named more specifically than the menu
 * choice it serves: "Roasted Lamb" should reach "Lamb portion".
 */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  return shared(a, b) / Math.min(a.size, b.size)
}

/**
 * Symmetric version, for deciding whether two options are the same choice
 * spelled differently. Containment is not enough here: "Chicken" appears in
 * "Korean Fried Chicken", but folding one into the other would cost a whole
 * menu line wrongly.
 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  return shared(a, b) / Math.max(a.size, b.size)
}

function suggestFor(
  name: string,
  components: Array<{ id: string; name: string; totalCost: number; tokens: Set<string> }>
): OptionSuggestion[] {
  const t = tokens(name)
  return components
    .map((c) => ({ c, score: overlap(t, c.tokens) }))
    .filter((x) => x.score >= 0.5)
    .sort((x, y) => y.score - x.score || x.c.name.length - y.c.name.length)
    .slice(0, 4)
    .map((x) => ({ source: 'Components' as const, id: x.c.id, name: x.c.name, cost: x.c.totalCost }))
}

export async function loadCostingCatalogue(): Promise<CostingCatalogue> {
  const [options, variants, componentRows, lastRun] = await Promise.all([
    prisma.costingOption.findMany({
      orderBy: { name: 'asc' },
      include: { aliases: { select: { value: true } } },
    }),
    prisma.productVariant.findMany({ select: { shopifyName: true, productId: true } }),
    prisma.component.findMany({ select: { id: true, name: true, totalCost: true } }),
    prisma.recalcRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
  ])

  const components = componentRows.map((c) => ({
    id: c.id,
    name: c.name,
    totalCost: Number(c.totalCost ?? 0),
    tokens: tokens(c.name),
  }))
  const componentCost = new Map(components.map((c) => [c.id, c.totalCost]))

  // One pass over the catalogue: which option each title segment belongs to,
  // and how much of the shop rides on it.
  const optionByAlias = new Map<string, string>()
  for (const option of options) {
    optionByAlias.set(aliasKey(option.name), option.id)
    for (const alias of option.aliases) optionByAlias.set(aliasKey(alias.value), option.id)
  }

  const variantCount = new Map<string, number>()
  const productsPerOption = new Map<string, Set<string>>()
  const unassignedCount = new Map<string, number>()

  for (const v of variants) {
    for (const part of splitParts(v.shopifyName)) {
      const optionId = optionByAlias.get(aliasKey(part))
      if (!optionId) {
        unassignedCount.set(part, (unassignedCount.get(part) ?? 0) + 1)
        continue
      }
      variantCount.set(optionId, (variantCount.get(optionId) ?? 0) + 1)
      const bucket = productsPerOption.get(optionId) ?? new Set<string>()
      bucket.add(v.productId)
      productsPerOption.set(optionId, bucket)
    }
  }

  const summaries: OptionSummary[] = options.map((option) => {
    const items = normalizeRows(option.items)
    const portionCost = items.reduce((sum, item) => {
      // Component rows reprice; anything else keeps the cost frozen on the row.
      const live = item.source.toLowerCase() === 'components' ? componentCost.get(item.id) : undefined
      return sum + (live ?? item.cost) * item.quantity
    }, 0)

    return {
      id: option.id,
      name: option.name,
      kind: option.kind,
      items,
      noIngredients: option.noIngredients,
      notes: option.notes,
      aliases: option.aliases.map((a) => a.value).sort(),
      variantCount: variantCount.get(option.id) ?? 0,
      productCount: productsPerOption.get(option.id)?.size ?? 0,
      suggestions: items.length === 0 && !option.noIngredients ? suggestFor(option.name, components) : [],
      foldCandidates: [],
      portionCost: Math.round(portionCost * 100) / 100,
    }
  })

  summaries.sort((a, b) => b.variantCount - a.variantCount || a.name.localeCompare(b.name))

  const costed = summaries.filter((o) => o.items.length > 0).map((o) => ({ o, tokens: tokens(o.name) }))
  for (const summary of summaries) {
    if (summary.items.length > 0 || summary.noIngredients) continue
    const t = tokens(summary.name)
    summary.foldCandidates = costed
      .filter((c) => c.o.id !== summary.id && similarity(t, c.tokens) >= 0.6)
      .sort((a, b) => b.o.variantCount - a.o.variantCount)
      .slice(0, 3)
      .map((c) => ({
        id: c.o.id,
        name: c.o.name,
        portionCost: c.o.portionCost,
        variantCount: c.o.variantCount,
      }))
  }

  // A new spelling arriving from Shopify should land here rather than silently
  // costing nothing, so match it loosely to an option that already exists.
  const optionByKey = new Map<string, { id: string; name: string }>()
  for (const option of options) {
    const key = normalizeOptionKey(option.name)
    if (key && !optionByKey.has(key)) optionByKey.set(key, { id: option.id, name: option.name })
  }

  const unassigned: UnassignedSegment[] = Array.from(unassignedCount)
    .map(([value, count]) => ({
      value,
      variantCount: count,
      suggestions: suggestFor(value, components),
      likelyOption: optionByKey.get(normalizeOptionKey(value)) ?? null,
    }))
    .sort((a, b) => b.variantCount - a.variantCount)

  const uncosted = summaries.filter((o) => o.items.length === 0 && !o.noIngredients)

  const lastEdit = options.reduce<Date | null>(
    (latest, o) => (!latest || o.updatedAt > latest ? o.updatedAt : latest),
    null
  )

  return {
    options: summaries,
    unassigned,
    repriceNeeded: Boolean(lastEdit && (!lastRun || lastEdit > lastRun.startedAt)),
    totals: {
      variants: variants.length,
      spellings: optionByAlias.size + unassigned.length,
      options: options.length,
      uncostedOptions: uncosted.length,
      variantChoicesUncosted: uncosted.reduce((s, o) => s + o.variantCount, 0),
    },
  }
}
