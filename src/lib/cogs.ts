// Single source of truth for order cost-of-goods on the owner dashboard.
//
// Three rules this engine enforces, which the previous per-route copies did not:
//
//  1. LIVE PRICING FIRST. `ProductVariant.totalCost` is what the pricing engine
//     recalculates from current supplier prices. The recipe JSON on the variant
//     carries a `cost` frozen at authoring time. Older dashboard code preferred
//     the frozen JSON, so COGS drifted below reality as supplier prices rose.
//  2. PARTY PACKS COST THEIR CONTENTS. A pack variant has no recipe of its own;
//     the food lives in `bundleItems` / `bundleDefaultItems`. Without expansion
//     a $2.5k pack contributed $0 and inflated gross profit.
//  3. CANCELLED ORDERS ARE NOT SALES. They are excluded from revenue and COGS.

import { prisma } from '@/lib/prisma'

export const GST_RATE = 1.15

/** Where a variant's unit cost came from. `none` means genuinely unresolvable. */
export type CostSource = 'live' | 'recipe' | 'bundle' | 'none'

export interface VariantCost {
  variantId: string
  sku: string | null
  name: string
  productTitle: string
  unitCost: number
  source: CostSource
  /** Children used when source === 'bundle', for drill-down display. */
  children?: Array<{ variantId: string; quantity: number; name: string; unitCost: number }>
}

export interface CogsIndex {
  byVariantId: Map<string, VariantCost>
  bySku: Map<string, VariantCost>
}

export interface CogsLine {
  sku: string
  variantId: string | null
  name: string
  productTitle: string
  variantTitle: string
  quantity: number
  unitCost: number
  lineCost: number
  source: CostSource
  /** Party-pack contents that make up unitCost. */
  children?: VariantCost['children']
}

export interface OrderCogs {
  cogs: number
  lines: CogsLine[]
  /** Item quantity we could not cost at all — the understatement risk. */
  missingQty: number
  totalQty: number
}

type RawVariant = {
  variantId: string
  shopifySku: string | null
  shopifyName: string
  totalCost: number | null
  ingredients: unknown
  bundleItems: unknown
  product: {
    productTitle: string
    baseIngredients: unknown
    bundleDefaultItems: unknown
  } | null
}

const VARIANT_SELECT = {
  variantId: true,
  shopifySku: true,
  shopifyName: true,
  totalCost: true,
  ingredients: true,
  bundleItems: true,
  product: {
    select: { productTitle: true, baseIngredients: true, bundleDefaultItems: true },
  },
} as const

/** Bundles may nest (a pack containing a pack). Guard runaway/cyclic graphs. */
const MAX_BUNDLE_DEPTH = 5

export function parseLineItems(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Sum of quantity x cost over a recipe JSON array (base or variant lines). */
function recipeCost(rows: unknown): number {
  if (!Array.isArray(rows)) return 0
  const sum = rows.reduce((total: number, row: any) => {
    const qty = Number(row?.quantity || 0)
    const cost = Number(row?.cost || 0)
    return total + (Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0)
  }, 0)
  return round2(sum)
}

function bundleChildrenOf(v: RawVariant): Array<{ variantId: string; quantity: number }> {
  const raw = Array.isArray(v.bundleItems) && v.bundleItems.length > 0
    ? v.bundleItems
    : (Array.isArray(v.product?.bundleDefaultItems) ? v.product!.bundleDefaultItems : [])
  const out: Array<{ variantId: string; quantity: number }> = []
  for (const row of raw as any[]) {
    const childId = String(row?.variantId || '').trim()
    if (!childId) continue
    const qty = Math.max(1, Number(row?.quantity || 1))
    out.push({ variantId: childId, quantity: Number.isFinite(qty) ? qty : 1 })
  }
  return out
}

export function round2(n: number): number {
  return Number((Math.round(n * 100) / 100).toFixed(2))
}

export function lineItemRefs(orders: Array<{ lineItems: unknown }>): { variantIds: string[]; skus: string[] } {
  const variantIds = new Set<string>()
  const skus = new Set<string>()
  for (const order of orders) {
    for (const li of flattenOrderItems(order.lineItems)) {
      const vId = String(li?.variant_id || li?.variantId || '')
      const sku = String(li?.sku || '')
      if (vId) variantIds.add(vId)
      if (sku) skus.add(sku)
    }
  }
  return { variantIds: Array.from(variantIds), skus: Array.from(skus) }
}

/**
 * Order line items plus any bundle children Shopify recorded on the line.
 * Used only for cost *lookups*; costing itself never adds both a pack and its
 * recorded children (see sumOrderCogs).
 */
function flattenOrderItems(lineItems: unknown): any[] {
  const items = parseLineItems(lineItems)
  const kids = items.flatMap((li: any) => {
    const arr = Array.isArray(li?.bundle_children)
      ? li.bundle_children
      : Array.isArray(li?.children)
        ? li.children
        : []
    return arr || []
  })
  return [...items, ...kids]
}

/**
 * Builds unit costs for every referenced variant, loading party-pack children
 * (and their children) that the orders never mention directly.
 */
export async function buildCogsIndex(variantIds: string[], skus: string[]): Promise<CogsIndex> {
  const wantedIds = new Set(variantIds.filter(Boolean))
  const wantedSkus = new Set(skus.filter(Boolean))

  const loaded = new Map<string, RawVariant>()
  const loadedSkus = new Map<string, RawVariant>()

  const initial = await Promise.all([
    wantedIds.size
      ? prisma.productVariant.findMany({ where: { variantId: { in: Array.from(wantedIds) } }, select: VARIANT_SELECT })
      : Promise.resolve([]),
    wantedSkus.size
      ? prisma.productVariant.findMany({ where: { shopifySku: { in: Array.from(wantedSkus) } }, select: VARIANT_SELECT })
      : Promise.resolve([]),
  ])

  for (const v of [...initial[0], ...initial[1]] as RawVariant[]) {
    loaded.set(v.variantId, v)
    if (v.shopifySku) loadedSkus.set(v.shopifySku, v)
  }

  // Pull in bundle children breadth-first so nested packs resolve too.
  for (let depth = 0; depth < MAX_BUNDLE_DEPTH; depth++) {
    const missing = new Set<string>()
    for (const v of loaded.values()) {
      for (const child of bundleChildrenOf(v)) {
        if (!loaded.has(child.variantId)) missing.add(child.variantId)
      }
    }
    if (missing.size === 0) break
    const children = (await prisma.productVariant.findMany({
      where: { variantId: { in: Array.from(missing) } },
      select: VARIANT_SELECT,
    })) as RawVariant[]
    if (children.length === 0) break
    for (const v of children) {
      loaded.set(v.variantId, v)
      if (v.shopifySku && !loadedSkus.has(v.shopifySku)) loadedSkus.set(v.shopifySku, v)
    }
  }

  const resolved = new Map<string, VariantCost>()

  function resolve(variantId: string, visiting: Set<string>): VariantCost {
    const cached = resolved.get(variantId)
    if (cached) return cached

    const raw = loaded.get(variantId)
    const base: VariantCost = {
      variantId,
      sku: raw?.shopifySku ?? null,
      name: raw?.shopifyName || variantId,
      productTitle: raw?.product?.productTitle || '',
      unitCost: 0,
      source: 'none',
    }
    if (!raw) return base

    // A pack referencing itself (directly or via a child) would recurse forever.
    if (visiting.has(variantId)) return base
    visiting.add(variantId)

    const live = Number(raw.totalCost || 0)
    const snapshot = recipeCost([
      ...(Array.isArray(raw.product?.baseIngredients) ? (raw.product!.baseIngredients as any[]) : []),
      ...(Array.isArray(raw.ingredients) ? (raw.ingredients as any[]) : []),
    ])

    let entry: VariantCost
    if (live > 0) {
      entry = { ...base, unitCost: round2(live), source: 'live' }
    } else if (snapshot > 0) {
      entry = { ...base, unitCost: snapshot, source: 'recipe' }
    } else {
      // No recipe of its own — this is the party-pack case.
      const children = bundleChildrenOf(raw)
      if (children.length > 0) {
        const detail = children.map((child) => {
          const childCost = resolve(child.variantId, visiting)
          return {
            variantId: child.variantId,
            quantity: child.quantity,
            name: childCost.name,
            unitCost: childCost.unitCost,
          }
        })
        const total = detail.reduce((s, c) => s + c.quantity * c.unitCost, 0)
        entry = total > 0
          ? { ...base, unitCost: round2(total), source: 'bundle', children: detail }
          : { ...base, children: detail }
      } else {
        entry = base
      }
    }

    visiting.delete(variantId)
    resolved.set(variantId, entry)
    return entry
  }

  const byVariantId = new Map<string, VariantCost>()
  const bySku = new Map<string, VariantCost>()
  for (const variantId of loaded.keys()) {
    const entry = resolve(variantId, new Set())
    byVariantId.set(variantId, entry)
    if (entry.sku && !bySku.has(entry.sku)) bySku.set(entry.sku, entry)
  }

  return { byVariantId, bySku }
}

export function lookupCost(li: any, index: CogsIndex): VariantCost | null {
  const vId = String(li?.variant_id || li?.variantId || '')
  const sku = String(li?.sku || '')
  return (vId && index.byVariantId.get(vId)) || (sku && index.bySku.get(sku)) || null
}

/**
 * Costs one order. Party packs are costed once, from their contents; when the
 * pack itself resolved as a bundle we ignore any children Shopify duplicated
 * onto the order line, otherwise the pack would be counted twice.
 */
export function sumOrderCogs(order: { lineItems: unknown }, index: CogsIndex): OrderCogs {
  const lines: CogsLine[] = []
  let cogs = 0
  let missingQty = 0
  let totalQty = 0

  const pushLine = (li: any, entry: VariantCost | null) => {
    const quantity = Number(li?.quantity || 0)
    const qty = Number.isFinite(quantity) ? quantity : 0
    const unitCost = entry?.unitCost ?? 0
    const lineCost = round2(qty * unitCost)
    totalQty += qty
    if (!(unitCost > 0)) missingQty += qty
    cogs += lineCost
    lines.push({
      sku: String(li?.sku || ''),
      variantId: entry?.variantId ?? String(li?.variant_id || li?.variantId || '') ?? null,
      name: String(li?.title || entry?.name || li?.sku || 'Item'),
      productTitle: entry?.productTitle || String(li?.title || ''),
      variantTitle: entry?.name || String(li?.variant_title || li?.variantTitle || ''),
      quantity: qty,
      unitCost,
      lineCost,
      source: entry?.source ?? 'none',
      children: entry?.source === 'bundle' ? entry.children : undefined,
    })
  }

  for (const li of parseLineItems(order.lineItems)) {
    const entry = lookupCost(li, index)
    pushLine(li, entry)

    const recordedChildren = Array.isArray(li?.bundle_children)
      ? li.bundle_children
      : Array.isArray(li?.children)
        ? li.children
        : []
    // Already counted inside the pack's own unit cost.
    if (entry?.source === 'bundle') continue
    for (const child of recordedChildren as any[]) {
      pushLine(child, lookupCost(child, index))
    }
  }

  return { cogs: round2(cogs), lines, missingQty, totalQty }
}

export function isCancelled(order: { cancelledAt?: Date | string | null }): boolean {
  return !!order?.cancelledAt
}

/** Revenue excluding GST, derived from the GST-inclusive Shopify total. */
export function revenueExGst(order: { totalPrice: unknown }): number {
  const inc = Number(order?.totalPrice)
  if (!Number.isFinite(inc)) return 0
  return inc / GST_RATE
}

export interface PeriodTotals {
  salesValue: number
  costOfSales: number
  totalGP: number
  gpPercentage: number
  staffCosts: number
  totalGPWithStaffing: number
  totalGPWithStaffingPercentage: number
  orderCount: number
  /** Percentage of item quantity we could actually cost. */
  cogsCoveragePct: number
  /** Delivery days in this period that have a signed-off (locked) cost. */
  lockedDayCount?: number
  /** Delivery days in this period that had at least one order. */
  dayCount?: number
}

/** Aggregates a set of (already cancellation-filtered) orders into card totals. */
export function periodTotals(
  orders: Array<{ totalPrice: unknown; lineItems: unknown }>,
  index: CogsIndex,
  staffCosts = 0
): PeriodTotals {
  let salesValue = 0
  let costOfSales = 0
  let missingQty = 0
  let totalQty = 0

  for (const order of orders) {
    salesValue += revenueExGst(order)
    const result = sumOrderCogs(order, index)
    costOfSales += result.cogs
    missingQty += result.missingQty
    totalQty += result.totalQty
  }

  salesValue = round2(salesValue)
  costOfSales = round2(costOfSales)
  const totalGP = round2(salesValue - costOfSales)
  const totalGPWithStaffing = round2(totalGP - staffCosts)

  return {
    salesValue,
    costOfSales,
    totalGP,
    gpPercentage: salesValue > 0 ? Number(((totalGP / salesValue) * 100).toFixed(1)) : 0,
    staffCosts: round2(staffCosts),
    totalGPWithStaffing,
    totalGPWithStaffingPercentage:
      salesValue > 0 ? Number(((totalGPWithStaffing / salesValue) * 100).toFixed(1)) : 0,
    orderCount: orders.length,
    cogsCoveragePct: totalQty > 0 ? Math.round(((totalQty - missingQty) / totalQty) * 100) : 100,
  }
}
