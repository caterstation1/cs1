import { prisma } from '@/lib/prisma'
import { getNZDateRangeForYmd, formatLocalDate } from '@/lib/date-utils'
import { isWellingtonOrder } from '@/lib/region'

type VariantCostMaps = {
  byVariantId: Map<string, number>
  bySku: Map<string, number>
}

export type RangePreset = '7D' | '30D' | '6M' | '12M' | 'YTD'

export function resolveBusinessDate(o: any): Date {
  return (
    (o?.deliveryDateResolved && new Date(o.deliveryDateResolved)) ||
    (o?.processedAt && new Date(o.processedAt)) ||
    new Date(o?.createdAt)
  )
}

export function deriveShippingCost(o: any): number {
  const diff = Math.max(0, Number(o?.totalPrice || 0) - Number(o?.subtotalPrice || 0))
  if (diff > 0) return Number(diff.toFixed(2))
  const lines = Array.isArray((o as any)?.shippingLines) ? (o as any).shippingLines : []
  const sumLines = lines.reduce((s: number, l: any) => s + Number(l?.price || 0), 0)
  return Number(sumLines.toFixed(2))
}

export function parseLineItems(li: any): any[] {
  if (Array.isArray(li)) return li
  if (typeof li === 'string') {
    try { return JSON.parse(li) } catch {}
  }
  return []
}

export function parseRangePreset(preset: RangePreset, todayLocal?: Date): { start: Date; end: Date; bucket: 'day' | 'week' | 'month' } {
  const today = todayLocal ?? new Date()
  const todayStr = formatLocalDate(today)
  const { end } = getNZDateRangeForYmd(todayStr)
  let start: Date
  let bucket: 'day' | 'week' | 'month' = 'day'
  switch (preset) {
    case '7D':
      start = new Date(end)
      start.setDate(start.getDate() - 6)
      bucket = 'day'
      break
    case '30D':
      start = new Date(end)
      start.setDate(start.getDate() - 29)
      bucket = 'day'
      break
    case '6M': {
      start = new Date(end)
      start.setMonth(start.getMonth() - 6)
      bucket = 'week'
      break
    }
    case '12M': {
      start = new Date(end)
      start.setMonth(start.getMonth() - 12)
      bucket = 'week'
      break
    }
    case 'YTD': {
      const yStart = new Date(end)
      yStart.setMonth(0, 1)
      yStart.setHours(0, 0, 0, 0)
      start = yStart
      bucket = 'week'
      break
    }
    default:
      start = new Date(end)
      start.setDate(start.getDate() - 6)
      bucket = 'day'
  }
  // Normalize to NZ-local midnight boundaries
  const startStr = formatLocalDate(start)
  const { start: nzStart } = getNZDateRangeForYmd(startStr)
  return { start: nzStart, end, bucket }
}

export function bucketKey(d: Date, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'day') return formatLocalDate(d)
  if (bucket === 'month') {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  // week: use Monday-aligned week key in NZ local
  const local = new Date(d)
  const day = local.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  local.setDate(local.getDate() - diffToMonday)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const dd = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}` // week start ymd
}

export function shouldIncludeOrder(
  o: any,
  opts: { includeCancelled?: boolean; includeUnpaid?: boolean }
): boolean {
  const { includeCancelled = false, includeUnpaid = false } = opts
  const isCancelled = !!o?.cancelledAt
  if (isCancelled && !includeCancelled) return false
  const fin = String(o?.financialStatus || '').toLowerCase()
  const isUnpaid = !(fin === 'paid' || fin === 'partially_paid')
  if (isUnpaid && !includeUnpaid) return false
  return true
}

export async function collectVariantCosts(variantIds: string[], skus: string[]): Promise<VariantCostMaps> {
  const uniqVar = Array.from(new Set(variantIds.filter(Boolean)))
  const uniqSku = Array.from(new Set(skus.filter(Boolean)))

  const variantsById = uniqVar.length
    ? await prisma.productVariant.findMany({
        where: { variantId: { in: uniqVar } },
        select: {
          variantId: true,
          shopifySku: true,
          totalCost: true,
          ingredients: true,
          product: { select: { baseIngredients: true } },
        },
      })
    : []

  const variantsBySku = uniqSku.length
    ? await prisma.productVariant.findMany({
        where: { shopifySku: { in: uniqSku } },
        select: {
          variantId: true,
          shopifySku: true,
          totalCost: true,
          ingredients: true,
          product: { select: { baseIngredients: true } },
        },
      })
    : []

  const missingVariantIds = variantsById
    .filter(v => !(typeof v.totalCost === 'number') || !isFinite(Number(v.totalCost)) || Number(v.totalCost) === 0)
    .map(v => v.variantId)

  const legacy = missingVariantIds.length
    ? await prisma.productWithCustomData.findMany({
        where: { variantId: { in: Array.from(new Set(missingVariantIds)) } },
        select: { variantId: true, totalCost: true },
      })
    : []
  const legacyCostByVariantId = new Map<string, number>(legacy.map(l => [String(l.variantId), Number(l.totalCost || 0)]))

  const calcTotal = (ings: any[]): number => {
    if (!Array.isArray(ings)) return 0
    const sum = ings.reduce((s, ing) => {
      const q = Number(ing?.quantity || 0)
      const c = Number(ing?.cost || 0)
      return s + (isFinite(q) && isFinite(c) ? q * c : 0)
    }, 0)
    return Number(sum.toFixed(2))
  }

  const byVariantId = new Map<string, number>()
  const bySku = new Map<string, number>()
  const allVariants = [...variantsById, ...variantsBySku]
  for (const v of allVariants as any[]) {
    const base = Array.isArray(v?.product?.baseIngredients) ? v.product.baseIngredients : []
    const varIngs = Array.isArray(v?.ingredients) ? v.ingredients : []
    const combined = calcTotal([...base, ...varIngs])
    const primary = Number(v?.totalCost || 0)
    const fallback = legacyCostByVariantId.get(String(v?.variantId)) || 0
    const unitCost = combined > 0 ? combined : (primary > 0 ? primary : fallback)
    if (v?.variantId) byVariantId.set(String(v.variantId), unitCost)
    if (v?.shopifySku) bySku.set(String(v.shopifySku), unitCost)
  }

  return { byVariantId, bySku }
}

export function sumItemsCost(items: any[], maps: VariantCostMaps): number {
  let total = 0
  const all = Array.isArray(items) ? items : []
  const children = all.flatMap((li: any) => {
    const arr = Array.isArray(li?.bundle_children) ? li.bundle_children
      : (Array.isArray(li?.children) ? li.children : [])
    return arr || []
  })
  const list = [...all, ...children]
  for (const li of list) {
    const qty = Number(li?.quantity || 0)
    const vId = String(li?.variant_id || li?.variantId || '')
    const sku = String(li?.sku || '')
    const unit =
      (vId && maps.byVariantId.get(vId)) ??
      (sku && maps.bySku.get(sku)) ??
      0
    total += (isFinite(qty) && isFinite(Number(unit)) ? qty * Number(unit) : 0)
  }
  return Number(total.toFixed(2))
}

export function calcCogsCoverage(orders: any[], maps: VariantCostMaps): { coveredRevenue: number; totalRevenue: number; pct: number } {
  let totalRevenue = 0
  let coveredRevenue = 0
  for (const o of orders) {
    const revenue = Number(o?.totalPrice || 0)
    totalRevenue += revenue
    const items = parseLineItems(o?.lineItems)
    const kids = items.flatMap((li:any) => {
      const arr = Array.isArray(li?.bundle_children) ? li.bundle_children
        : (Array.isArray(li?.children) ? li.children : [])
      return arr || []
    })
    const allLis = [...items, ...kids]
    const isCovered = allLis.every(li => {
      const vId = String(li?.variant_id || li?.variantId || '')
      const sku = String(li?.sku || '')
      const unit = (vId && maps.byVariantId.get(vId)) ?? (sku && maps.bySku.get(sku)) ?? null
      return typeof unit === 'number' && isFinite(unit) && unit > 0
    })
    if (isCovered) coveredRevenue += revenue
  }
  const pct = totalRevenue > 0 ? Math.round((coveredRevenue / totalRevenue) * 100) : 0
  return { coveredRevenue: Number(coveredRevenue.toFixed(2)), totalRevenue: Number(totalRevenue.toFixed(2)), pct }
}

export function groupKeyForOrder(o: any, groupBy: 'zone' | 'suburb'): string {
  // Fallback grouping by shippingAddress.city
  const ship = (o?.shippingAddress || {}) as any
  const rawCity = String(ship?.city || '').trim()
  if (groupBy === 'zone') {
    // If zones are introduced later, map here; for now use city and WLG/Akl guard
    if (isWellingtonOrder(o)) return rawCity || 'Wellington'
    return rawCity || 'Auckland/Other'
  }
  return rawCity || 'Unknown'
}

