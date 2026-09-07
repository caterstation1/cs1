import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'
import { isWellingtonOrder } from '@/lib/region'

type DayKey = string // 'yyyy-MM-dd'

function toDayKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const city = (url.searchParams.get('city') || 'AKL').toUpperCase() // AKL|WLG
    const startStr = url.searchParams.get('start')
    const days = Math.min(31, Math.max(1, parseInt(url.searchParams.get('days') || '7', 10)))
    if (!startStr) return NextResponse.json({ error: 'start is required (YYYY-MM-DD)' }, { status: 400 })
    const [y, m, d] = startStr.split('-').map(Number)
    const start = new Date(y, (m - 1), d)

    // Build day slots
    const dayKeys: DayKey[] = Array.from({ length: days }, (_, i) => {
      const dt = new Date(start)
      dt.setDate(dt.getDate() + i)
      return toDayKey(dt)
    })
    const dayIndex = new Map(dayKeys.map((k, i) => [k, i]))

    // Bakery variant IDs (same definition as send-bakery-email)
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

    // Compute end (exclusive)
    const end = new Date(start)
    end.setDate(end.getDate() + days)
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
    const filtered = orders.filter(o => (city === 'WLG' ? isWellingtonOrder(o) : !isWellingtonOrder(o)))

    const allLineItems: Array<{ order: any; dayKey: DayKey; item: any }> = []
    function resolveDayKey(order: any): DayKey | null {
      if (order.deliveryDateResolved) {
        try {
          return toDayKey(new Date(order.deliveryDateResolved as any))
        } catch {}
      }
      if (order.deliveryDate) {
        const d = parseLocalDate(String(order.deliveryDate))
        if (d) return toDayKey(d)
      }
      const noteAttrs = order.noteAttributes || order.note_attributes || []
      const dateAttr = Array.isArray(noteAttrs) ? noteAttrs.find((a: any) => (a?.name || '').toLowerCase() === 'delivery date') : null
      if (dateAttr && dateAttr.value) {
        const d = parseLocalDate(String(dateAttr.value))
        if (d) return toDayKey(d)
      }
      if (order.tags) {
        const m = String(order.tags).match(/\b\w{3}\s\w{3}\s\d{2}\s\d{4}\b/)
        if (m) {
          const d = parseLocalDate(m[0])
          if (d) return toDayKey(d)
        }
      }
      if (order.createdAt) {
        try {
          return toDayKey(new Date(order.createdAt as any))
        } catch {}
      }
      return null
    }

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
      include: { product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true, heroImageUrl: true, bakery: true } } }
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
        include: { product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true, heroImageUrl: true, bakery: true } } }
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
        include: { product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true, heroImageUrl: true, bakery: true } } }
      })
      childVariants.forEach(v => variantById.set(v.variantId, v))
      variants = [...variants, ...childVariants]
    }

    const zero = () => Array(dayKeys.length).fill(0)
    const products: Record<string, number[]> = {}
    const productImages: Record<string, string> = {}

    function bump(map: Record<string, number[]>, key: string, dayIdx: number, qty: number) {
      if (!key) return
      if (!map[key]) map[key] = zero()
      map[key][dayIdx] += qty
    }

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
          ? children.map(c => ({ variantId: c.variantId, quantity: qty * c.quantity, parentPack: true }))
          : [{ variantId, quantity: qty, parentPack: false }]

      for (const ei of effectiveItems) {
        const itemSku = String(it.sku || '').trim()
        const vv = variantById.get(ei.variantId) || (itemSku ? variantsBySku.get(itemSku) : undefined)
        if (!vv) continue
        const isBakery = bakeryVariantIds.has(vv.variantId) || vv.product?.bakery === true
        if (!isBakery) continue

        const title = String(vv?.shopifyName || vv?.shopifyTitle || it.title || '')
        const display = (vv?.product?.displayName || vv?.displayName || '').trim() || title

        bump(products, display, dayIdx, ei.quantity)

        const hero = vv?.product?.heroImageUrl
        if (hero && display && !productImages[display]) productImages[display] = hero
      }
    }

    return new NextResponse(
      JSON.stringify({
        days: dayKeys,
        products,
        productImages
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
    console.error('Error in bakery summary:', e)
    return NextResponse.json({ error: 'Failed to build bakery summary' }, { status: 500 })
  }
}
