import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'
import { isWellingtonOrder } from '@/lib/region'

// B&B (Bread & Butcher) weekly owing summary.
// Butcher: daily C/H protein counts (runsheet logic) priced per-kg from Other tab.
// Bakery: daily bakery-flagged product counts priced from Golden Kit Other-tab ingredients.

const DAYS = 7
const CHICKEN_KG_PER_UNIT = 2.5
const HAM_KG_PER_UNIT = 2.2

type DayKey = string // 'yyyy-MM-dd'

function toDayKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isAddonSku(sku?: string | null): boolean {
  const s = String(sku || '')
  return s.startsWith('ADD') || s.startsWith('AA')
}

function effectiveMeats(variant: any): string[] {
  const meatsArr = Array.isArray(variant?.meats) ? (variant.meats as any[]) : null
  const nonEmpty = meatsArr?.map(m => (m ?? '').toString().trim()).filter(Boolean) || []
  if (nonEmpty.length > 0) return nonEmpty
  return [variant?.meat1, variant?.meat2]
    .map(m => (m ?? '').toString().trim())
    .filter(Boolean)
}

function parseJsonArray(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const startStr = url.searchParams.get('start')
    if (!startStr) return NextResponse.json({ error: 'start is required (YYYY-MM-DD)' }, { status: 400 })
    const [y, m, d] = startStr.split('-').map(Number)
    const start = new Date(y, m - 1, d)

    const dayKeys: DayKey[] = Array.from({ length: DAYS }, (_, i) => {
      const dt = new Date(start)
      dt.setDate(dt.getDate() + i)
      return toDayKey(dt)
    })
    const dayIndex = new Map(dayKeys.map((k, i) => [k, i]))

    // ---- Pricing lookups from Other tab ----
    const otherProducts = await prisma.otherProduct.findMany()
    const otherById = new Map(otherProducts.map(p => [p.id, p]))

    // Manual alignments: bakery display item -> Other-tab product (used to
    // price items that have no Golden Kit ingredient linked)
    const bakeryAlignments = await prisma.bakeryCostAlignment.findMany()
    const alignmentByName = new Map(bakeryAlignments.map(a => [a.bakeryItemName, a]))
    const findOther = (needle: string) =>
      otherProducts.find(p => (p.name || '').toLowerCase().includes(needle)) || null
    const chickenOther = findOther('chicken thigh')
    const hamOther = findOther('sliced ham')
    const isBakerySupplier = (supplier?: string | null) =>
      (supplier || '').toLowerCase().includes('golden kit')

    // ---- Bakery variant IDs (same definition as /api/bakery/summary) ----
    const bakeryProducts = await prisma.shopifyProduct.findMany({
      where: { bakery: true },
      include: { variants: true }
    })
    const bakeryVariantIds = new Set<string>()
    bakeryProducts.forEach(product => {
      product.variants.forEach(variant => {
        bakeryVariantIds.add(variant.variantId)
      })
    })

    // ---- Fetch orders for the week (resolved + recently created unresolved) ----
    const end = new Date(start)
    end.setDate(end.getDate() + DAYS)
    const ordersResolved = await prisma.order.findMany({
      where: {
        deliveryDateResolved: {
          gte: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          lt: new Date(end.getFullYear(), end.getMonth(), end.getDate())
        }
      },
      orderBy: { deliveryDateResolved: 'asc' }
    })
    const recentStart = new Date(start)
    recentStart.setDate(recentStart.getDate() - 120)
    const recentEnd = new Date(end)
    recentEnd.setDate(recentEnd.getDate() + 7)
    const ordersUnresolved = await prisma.order.findMany({
      where: {
        deliveryDateResolved: null,
        createdAt: {
          gte: new Date(recentStart.getFullYear(), recentStart.getMonth(), recentStart.getDate()),
          lt: new Date(recentEnd.getFullYear(), recentEnd.getMonth(), recentEnd.getDate())
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    const orders = [...ordersResolved, ...ordersUnresolved]
    // AKL scope only (both suppliers are Auckland)
    const filtered = orders.filter(o => !isWellingtonOrder(o))

    function resolveDayKey(order: any): DayKey | null {
      if (order.deliveryDateResolved) {
        try {
          return toDayKey(new Date(order.deliveryDateResolved as any))
        } catch {}
      }
      if (order.deliveryDate) {
        const dd = parseLocalDate(String(order.deliveryDate))
        if (dd) return toDayKey(dd)
      }
      const noteAttrs = order.noteAttributes || order.note_attributes || []
      const dateAttr = Array.isArray(noteAttrs) ? noteAttrs.find((a: any) => (a?.name || '').toLowerCase() === 'delivery date') : null
      if (dateAttr && dateAttr.value) {
        const dd = parseLocalDate(String(dateAttr.value))
        if (dd) return toDayKey(dd)
      }
      if (order.tags) {
        const match = String(order.tags).match(/\b\w{3}\s\w{3}\s\d{2}\s\d{4}\b/)
        if (match) {
          const dd = parseLocalDate(match[0])
          if (dd) return toDayKey(dd)
        }
      }
      if (order.createdAt) {
        try {
          return toDayKey(new Date(order.createdAt as any))
        } catch {}
      }
      return null
    }

    const allLineItems: Array<{ order: any; dayKey: DayKey; item: any }> = []
    for (const o of filtered) {
      const dk = resolveDayKey(o)
      if (!dk || !dayIndex.has(dk)) continue
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') {
        try {
          items = JSON.parse(o.lineItems)
        } catch {}
      }
      for (const it of items) {
        allLineItems.push({ order: o, dayKey: dk, item: it })
      }
    }

    // ---- Load variants referenced by the line items (plus bundle children) ----
    const productSelect = {
      displayName: true,
      isPartyPackDefault: true,
      bundleDefaultItems: true,
      heroImageUrl: true,
      bakery: true,
      baseIngredients: true
    } as const

    const variantIds = Array.from(
      new Set(
        allLineItems
          .map(x => x.item?.variant_id ?? x.item?.variantId)
          .filter(Boolean)
          .map((v: any) => String(v))
      )
    )
    const itemSkus = Array.from(
      new Set(
        allLineItems
          .map(x => String(x.item?.sku || '').trim())
          .filter(Boolean)
      )
    )

    let variants = await prisma.productVariant.findMany({
      where: { variantId: { in: variantIds } },
      include: { product: { select: productSelect } }
    })
    const variantById = new Map(variants.map(v => [v.variantId, v]))
    const variantsBySku = new Map(
      variants
        .map(v => [String(v.shopifySku || '').trim(), v] as const)
        .filter(([sku]) => Boolean(sku))
    )

    if (itemSkus.length) {
      const skuVariants = await prisma.productVariant.findMany({
        where: { shopifySku: { in: itemSkus } },
        include: { product: { select: productSelect } }
      })
      for (const sv of skuVariants) {
        if (!variantById.has(sv.variantId)) variantById.set(sv.variantId, sv)
        const sku = String(sv.shopifySku || '').trim()
        if (sku && !variantsBySku.has(sku)) variantsBySku.set(sku, sv)
      }
      variants = [...variants, ...skuVariants]
    }

    const childIds = new Set<string>()
    for (const v of variants) {
      try {
        if (v.isPartyPack && v.bundleItems) {
          const arr = Array.isArray(v.bundleItems) ? (v.bundleItems as any[]) : JSON.parse(String(v.bundleItems))
          arr.forEach((c: any) => childIds.add(String(c.variantId)))
        } else if (v.product?.isPartyPackDefault && v.product.bundleDefaultItems) {
          const arr = Array.isArray(v.product.bundleDefaultItems)
            ? (v.product.bundleDefaultItems as any[])
            : JSON.parse(String(v.product.bundleDefaultItems))
          arr.forEach((c: any) => childIds.add(String(c.variantId)))
        }
      } catch {}
    }
    const missingChildIds = Array.from(childIds).filter(id => !variantById.has(id))
    if (missingChildIds.length) {
      const childVariants = await prisma.productVariant.findMany({
        where: { variantId: { in: missingChildIds } },
        include: { product: { select: productSelect } }
      })
      childVariants.forEach(v => variantById.set(v.variantId, v))
      variants = [...variants, ...childVariants]
    }

    // ---- Bakery unit cost: Golden Kit Other-tab ingredients on the product/variant ----
    function bakeryUnitCost(variant: any): number | null {
      const entries = [
        ...parseJsonArray(variant?.product?.baseIngredients),
        ...parseJsonArray(variant?.ingredients)
      ]
      let total = 0
      let found = false
      for (const ing of entries) {
        if (String(ing?.source || '').toLowerCase() !== 'other') continue
        const other = otherById.get(String(ing?.id || ''))
        if (!other || !isBakerySupplier(other.supplier)) continue
        const qty = Number(ing?.quantity) || 0
        total += (other.cost || 0) * (qty > 0 ? qty : 1)
        found = true
      }
      return found ? total : null
    }

    // ---- Aggregate ----
    const zero = () => Array(dayKeys.length).fill(0)
    const chicken = zero()
    const ham = zero()
    const bakeryCounts: Record<string, number[]> = {}
    const bakeryUnitCosts: Record<string, number | null> = {}

    for (const row of allLineItems) {
      const dayIdx = dayIndex.get(row.dayKey)!
      const it = row.item
      const qty = Math.max(1, parseInt(String(it.quantity || '1'), 10))
      const variantId = String(it.variant_id ?? it.variantId ?? '')
      const v = variantById.get(variantId)

      let children: Array<{ variantId: string; quantity: number }> = []
      if (v?.isPartyPack && v?.bundleItems) {
        try {
          const arr = Array.isArray(v.bundleItems) ? v.bundleItems : JSON.parse(String(v.bundleItems))
          children = arr.map((c: any) => ({ variantId: String(c.variantId), quantity: Math.max(1, parseInt(String(c.quantity || '1'), 10)) }))
        } catch {}
      } else if (v?.product?.isPartyPackDefault && v?.product?.bundleDefaultItems) {
        try {
          const arr = Array.isArray(v.product.bundleDefaultItems) ? v.product.bundleDefaultItems : JSON.parse(String(v.product.bundleDefaultItems))
          children = arr.map((c: any) => ({ variantId: String(c.variantId), quantity: Math.max(1, parseInt(String(c.quantity || '1'), 10)) }))
        } catch {}
      }

      const effectiveItems =
        children.length > 0
          ? children.map(c => ({ variantId: c.variantId, quantity: qty * c.quantity }))
          : [{ variantId, quantity: qty }]

      for (const ei of effectiveItems) {
        const itemSku = String(it.sku || '').trim()
        const vv = variantById.get(ei.variantId) || (itemSku ? variantsBySku.get(itemSku) : undefined)
        if (!vv) continue

        // Butcher: protein counts from meat initials (runsheet logic), excluding addons
        if (!isAddonSku(vv.shopifySku) && !isAddonSku(it.sku)) {
          const initials = effectiveMeats(vv)
            .map(s => s.trim()[0]?.toUpperCase())
            .filter(Boolean)
          for (const init of initials) {
            if (init === 'C') chicken[dayIdx] += ei.quantity
            if (init === 'H') ham[dayIdx] += ei.quantity
          }
        }

        // Bakery: bakery-flagged products only
        const isBakery = bakeryVariantIds.has(vv.variantId) || vv.product?.bakery === true
        if (!isBakery) continue

        const title = String(vv?.shopifyName || vv?.shopifyTitle || it.title || '')
        const display = (vv?.product?.displayName || vv?.displayName || '').trim() || title
        if (!display) continue

        if (!bakeryCounts[display]) bakeryCounts[display] = zero()
        bakeryCounts[display][dayIdx] += ei.quantity

        if (bakeryUnitCosts[display] == null) {
          const cost = bakeryUnitCost(vv)
          if (cost != null) bakeryUnitCosts[display] = cost
          else if (!(display in bakeryUnitCosts)) bakeryUnitCosts[display] = null
        }
      }
    }

    const bakeryItems = Object.keys(bakeryCounts)
      .sort((a, b) => a.localeCompare(b))
      .map(name => {
        let unitCost = bakeryUnitCosts[name] ?? null
        let alignedOtherProductId: string | null = null
        let alignedOtherProductName: string | null = null
        // Fall back to a manual Other-tab alignment when the product has no
        // Golden Kit ingredient cost.
        if (unitCost == null) {
          const alignment = alignmentByName.get(name)
          const other = alignment ? otherById.get(alignment.otherProductId) : undefined
          if (other) {
            unitCost = other.cost ?? null
            alignedOtherProductId = other.id
            alignedOtherProductName = other.name
          }
        }
        return {
          name,
          unitCost,
          perDay: bakeryCounts[name],
          alignedOtherProductId,
          alignedOtherProductName
        }
      })

    return new NextResponse(
      JSON.stringify({
        days: dayKeys,
        butcher: {
          chicken,
          ham,
          chickenKgPerUnit: CHICKEN_KG_PER_UNIT,
          hamKgPerUnit: HAM_KG_PER_UNIT,
          chickenCostPerKg: chickenOther?.cost ?? null,
          hamCostPerKg: hamOther?.cost ?? null,
          chickenProductName: chickenOther?.name ?? null,
          hamProductName: hamOther?.name ?? null
        },
        bakery: {
          items: bakeryItems
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    )
  } catch (e) {
    console.error('Error in B&B summary:', e)
    return NextResponse.json({ error: 'Failed to build B&B summary' }, { status: 500 })
  }
}
