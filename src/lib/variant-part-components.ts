// Part-scoped edits to the recipe rows stored on ProductVariant.ingredients.
//
// The Variants tab is organised by title *part* ("Pulled Brisket (GF)"), not by
// variant, so every operation here fans out to all variants whose title carries
// that part. Matching is on exact ' / ' segments: a `contains` query alone would
// let "Chicken" match "Chilli Chicken".

import { prisma } from '@/lib/prisma'
import { splitParts } from '@/lib/variant-part-edit'

export interface RecipeRow {
  source: string
  id: string
  name: string
  quantity: number
  cost: number
  unit: string
  ingredientId?: string | null
}

export interface PartVariant {
  variantId: string
  shopifyName: string
  shopifySku: string | null
  productTitle: string
  ingredients: RecipeRow[]
}

/** Identity of a recipe row: the catalogue item it points at. */
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

/** Every variant whose title contains `partName` as a whole ' / ' segment. */
export async function variantsForPart(partName: string): Promise<PartVariant[]> {
  const trimmed = partName.trim()
  if (!trimmed) return []

  const candidates = await prisma.productVariant.findMany({
    where: { shopifyName: { contains: trimmed, mode: 'insensitive' } },
    select: {
      variantId: true,
      shopifyName: true,
      shopifySku: true,
      ingredients: true,
      product: { select: { productTitle: true } },
    },
  })

  return candidates
    .filter((v) => splitParts(v.shopifyName).includes(trimmed))
    .map((v) => ({
      variantId: v.variantId,
      shopifyName: v.shopifyName,
      shopifySku: v.shopifySku,
      productTitle: v.product?.productTitle ?? '',
      ingredients: normalizeRows(v.ingredients),
    }))
}

export interface StoredItemSummary extends RecipeRow {
  key: string
  /** How many of the part's variants currently carry this row. */
  variantCount: number
  /** True when every variant of the part has it. */
  onAll: boolean
}

/** The distinct rows stored across a part's variants, for display and deletion. */
export function summariseStoredItems(variants: PartVariant[]): StoredItemSummary[] {
  const map = new Map<string, StoredItemSummary>()
  for (const v of variants) {
    const seenInThisVariant = new Set<string>()
    for (const row of v.ingredients) {
      const key = rowKey(row)
      if (seenInThisVariant.has(key)) continue
      seenInThisVariant.add(key)
      const existing = map.get(key)
      if (existing) existing.variantCount++
      else map.set(key, { ...row, key, variantCount: 1, onAll: false })
    }
  }
  const total = variants.length
  const out = Array.from(map.values())
  for (const item of out) item.onAll = total > 0 && item.variantCount === total
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export type PartComponentOp = 'add' | 'remove'

export interface PartComponentResult {
  partName: string
  op: PartComponentOp
  variantsMatched: number
  variantsChanged: number
  rowsAdded: number
  rowsRemoved: number
  changed: Array<{ variantId: string; shopifyName: string; added: string[]; removed: string[] }>
}

/**
 * Adds rows to (or removes rows from) every variant carrying the part.
 * Adding is idempotent: a row already present by `rowKey` is left alone rather
 * than duplicated, which is how the old client-side loop grew duplicate lines.
 */
export async function applyPartComponentOp(
  partName: string,
  op: PartComponentOp,
  items: RecipeRow[]
): Promise<PartComponentResult> {
  const variants = await variantsForPart(partName)
  const keys = new Set(items.map(rowKey))

  const result: PartComponentResult = {
    partName,
    op,
    variantsMatched: variants.length,
    variantsChanged: 0,
    rowsAdded: 0,
    rowsRemoved: 0,
    changed: [],
  }

  for (const v of variants) {
    const present = new Set(v.ingredients.map(rowKey))
    let next: RecipeRow[]
    const added: string[] = []
    const removed: string[] = []

    if (op === 'add') {
      const missing = items.filter((item) => !present.has(rowKey(item)))
      if (missing.length === 0) continue
      next = [...v.ingredients, ...missing]
      missing.forEach((m) => added.push(m.name))
    } else {
      next = v.ingredients.filter((row) => !keys.has(rowKey(row)))
      if (next.length === v.ingredients.length) continue
      v.ingredients.filter((row) => keys.has(rowKey(row))).forEach((r) => removed.push(r.name))
    }

    await prisma.productVariant.update({
      where: { variantId: v.variantId },
      data: { ingredients: next as any },
    })

    result.variantsChanged++
    result.rowsAdded += added.length
    result.rowsRemoved += removed.length
    result.changed.push({ variantId: v.variantId, shopifyName: v.shopifyName, added, removed })
  }

  return result
}

/** The aligned rows a variant is missing, keyed by catalogue item. */
export function missingAlignedRows(variantRows: RecipeRow[], aligned: RecipeRow[]): RecipeRow[] {
  const present = new Set(variantRows.map(rowKey))
  return aligned.filter((row) => !present.has(rowKey(row)))
}

export async function getAlignment(partName: string): Promise<RecipeRow[]> {
  const record = await prisma.variantPartAlignment.findUnique({ where: { partName: partName.trim() } })
  return record ? normalizeRows(record.items) : []
}

export async function getAlignments(partNames: string[]): Promise<Map<string, RecipeRow[]>> {
  if (partNames.length === 0) return new Map()
  const records = await prisma.variantPartAlignment.findMany({
    where: { partName: { in: partNames.map((p) => p.trim()) } },
  })
  return new Map(records.map((r) => [r.partName, normalizeRows(r.items)]))
}
