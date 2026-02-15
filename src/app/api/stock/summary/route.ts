import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'
import { buildComponentMap, expandToRawLeaves } from '@/lib/components-expander'
import { isWellingtonOrder } from '@/lib/region'

type DayKey = string // 'yyyy-MM-dd'

function toDayKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// use centralized region detection

function isAddonSku(sku?: string | null): boolean {
  if (!sku) return false
  const s = sku.toUpperCase()
  return s.startsWith('ADD') || s.startsWith('AA')
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

    // Compute end (exclusive)
    const end = new Date(start); end.setDate(end.getDate() + days)
    // 1) Orders already resolved to a delivery day in range
    const ordersResolved = await prisma.order.findMany({
      where: {
        deliveryDateResolved: {
          gte: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          lt: new Date(end.getFullYear(), end.getMonth(), end.getDate())
        }
      },
      orderBy: { deliveryDateResolved: 'asc' }
    })
    // 2) Unresolved but potentially relevant (recent/pending) — fetch a wider window by createdAt
    const recentStart = new Date(start); recentStart.setDate(recentStart.getDate() - 120)
    const recentEnd = new Date(end); recentEnd.setDate(recentEnd.getDate() + 7)
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

    // City filter same as runsheet
    const filtered = orders.filter(o => city === 'WLG' ? isWellingtonOrder(o) : !isWellingtonOrder(o))

    // Collect all variantIds present
    const allLineItems: Array<{ order: any; dayKey: DayKey; item: any }> = []
    function resolveDayKey(order: any): DayKey | null {
      // 1) deliveryDateResolved
      if (order.deliveryDateResolved) {
        try { return toDayKey(new Date(order.deliveryDateResolved as any)) } catch {}
      }
      // 2) deliveryDate (YYYY-MM-DD)
      if (order.deliveryDate) {
        const d = parseLocalDate(String(order.deliveryDate))
        if (d) return toDayKey(d)
      }
      // 3) note attributes
      const noteAttrs = order.noteAttributes || order.note_attributes || []
      const dateAttr = Array.isArray(noteAttrs) ? noteAttrs.find((a: any) => (a?.name || '').toLowerCase() === 'delivery date') : null
      if (dateAttr && dateAttr.value) {
        const d = parseLocalDate(String(dateAttr.value))
        if (d) return toDayKey(d)
      }
      // 4) tags (look for patterns like 'Mon Nov 06 2025')
      if (order.tags) {
        const m = String(order.tags).match(/\b\w{3}\s\w{3}\s\d{2}\s\d{4}\b/)
        if (m) {
          const d = parseLocalDate(m[0])
          if (d) return toDayKey(d)
        }
      }
      // 5) fallback createdAt
      if (order.createdAt) {
        try { return toDayKey(new Date(order.createdAt as any)) } catch {}
      }
      return null
    }

    for (const o of filtered) {
      const dk = resolveDayKey(o)
      if (!dk || !dayIndex.has(dk)) continue
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') { try { items = JSON.parse(o.lineItems) } catch {} }
      for (const it of items) {
        allLineItems.push({ order: o, dayKey: dk, item: it })
      }
    }

    let variantIds = Array.from(new Set(
      allLineItems
        .map(x => x.item?.variant_id ?? x.item?.variantId)
        .filter(Boolean)
        .map((v: any) => String(v))
    ))

    // Load variant data with parent
    let variants = await prisma.productVariant.findMany({
      where: { variantId: { in: variantIds } },
      include: { product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true, baseIngredients: true } } }
    })
    const variantById = new Map(variants.map(v => [v.variantId, v]))
    // Load bundle children one pass
    const childIds = new Set<string>()
    for (const v of variants) {
      try {
        if (v.isPartyPack && v.bundleItems) {
          const arr = Array.isArray(v.bundleItems) ? v.bundleItems as any[] : JSON.parse(String(v.bundleItems))
          arr.forEach((c: any) => childIds.add(String(c.variantId)))
        } else if (v.product?.isPartyPackDefault && v.product.bundleDefaultItems) {
          const arr = Array.isArray(v.product.bundleDefaultItems) ? v.product.bundleDefaultItems as any[] : JSON.parse(String(v.product.bundleDefaultItems))
          arr.forEach((c: any) => childIds.add(String(c.variantId)))
        }
      } catch {}
    }
    const missingChildIds = Array.from(childIds).filter(id => !variantById.has(id))
    if (missingChildIds.length) {
      const childVariants = await prisma.productVariant.findMany({
        where: { variantId: { in: missingChildIds } },
        include: { product: { select: { displayName: true, isPartyPackDefault: true, bundleDefaultItems: true, baseIngredients: true } } }
      })
      childVariants.forEach(v => variantById.set(v.variantId, v))
      variants = [...variants, ...childVariants]
    }

    // Preload components catalog for prep category bucketing
    const comps = await prisma.component.findMany({ select: { id: true, name: true, prepCategories: true, prepCategory: true, ingredients: true } })
    const compMap = new Map<string, { cold: boolean; hot: boolean; desserts: boolean }>()
    const fullCompMap = buildComponentMap(comps as any)
    for (const c of comps) {
      const cats: string[] = Array.isArray(c.prepCategories) ? (c.prepCategories as any) : (c.prepCategory ? [c.prepCategory] : [])
      const norm = new Set(cats.map(s => String(s).toLowerCase()))
      compMap.set((c.name || '').toLowerCase(), {
        cold: norm.has('cold kitchen'),
        hot: norm.has('hot kitchen'),
        desserts: norm.has('desserts')
      })
    }

    // Init matrices
    const zero = () => Array(dayKeys.length).fill(0)
    const products: Record<string, number[]> = {}
    const addons: Record<string, number[]> = {}
    const cold: Record<string, number[]> = {}
    const hot: Record<string, number[]> = {}
    const desserts: Record<string, number[]> = {}
    const proteins: Record<string, number[]> = {}
    const sw: number[] = zero()
    const raw: Record<string, number[]> = {}

    // Helper to bump
    function bump(map: Record<string, number[]>, key: string, dayIdx: number, qty: number) {
      if (!key) return
      if (!map[key]) map[key] = zero()
      map[key][dayIdx] += qty
    }

    // Expand packs and aggregate
    for (const row of allLineItems) {
      const dayIdx = dayIndex.get(row.dayKey)!
      const it = row.item
      const qty = Math.max(1, parseInt(String(it.quantity || '1'), 10))
      const variantId = String(it.variant_id ?? it.variantId ?? '')
      const v = variantById.get(variantId)

      // SW count
      const variantTitle = String(it.variant_title || it.variantTitle || '')
      const isServeware = (v?.serveware === true) || variantTitle.toLowerCase().includes('yes serveware')
      if (isServeware) sw[dayIdx] += qty

      // Resolve pack children
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

      const effectiveItems = children.length > 0
        ? children.map(c => ({ variantId: c.variantId, quantity: qty * c.quantity, parentPack: true }))
        : [{ variantId, quantity: qty, parentPack: false }]

      for (const ei of effectiveItems) {
        const vv = variantById.get(ei.variantId)
        const sku = String(it.sku || vv?.shopifySku || '')
        const title = String(vv?.shopifyName || vv?.shopifyTitle || it.title || '')
        const display = (vv?.product?.displayName || vv?.displayName || '').trim() || title

        if (isAddonSku(sku)) {
          bump(addons, display, dayIdx, ei.quantity)
        } else if (!ei.parentPack) {
          bump(products, display, dayIdx, ei.quantity)
        } else {
          // pack child contributes to products too
          bump(products, display, dayIdx, ei.quantity)
        }

        // Proteins
        const meatsArr: (string | null)[] = Array.isArray(vv?.meats) ? (vv!.meats as any) : [vv?.meat1 ?? null, vv?.meat2 ?? null]
        for (const m of meatsArr) {
          const code = (m ?? '').toString().trim()
          if (!code) continue
          if (!proteins[code]) proteins[code] = zero()
          proteins[code][dayIdx] += ei.quantity
        }

        // Components: bucket per prep area
        try {
          const variantIngredients: any[] = Array.isArray(vv?.ingredients)
            ? (vv!.ingredients as any[])
            : []
          let baseIngredients: any[] = []
          try {
            const bi = (vv as any)?.product?.baseIngredients
            if (Array.isArray(bi)) baseIngredients = bi as any[]
            else if (bi) baseIngredients = JSON.parse(String(bi))
          } catch {}
          // Legacy component bucketing (for raw=0)
          {
            const allIngs = [...variantIngredients, ...baseIngredients]
            for (const ing of allIngs) {
              const key = (ing?.name || '').toLowerCase()
              const map = compMap.get(key)
              if (!map) continue
              const amount = Math.max(1, parseFloat(String(ing.quantity ?? 1))) * ei.quantity
              if (map.cold) bump(cold, ing.name, dayIdx, amount)
              if (map.hot) bump(hot, ing.name, dayIdx, amount)
              if (map.desserts) bump(desserts, ing.name, dayIdx, amount)
            }
          }
          // Raw ingredients expansion (for raw=1)
          {
            const leaves1 = expandToRawLeaves(fullCompMap, variantIngredients, ei.quantity)
            let leaves2: any[] = []
            try {
              leaves2 = expandToRawLeaves(fullCompMap, baseIngredients, ei.quantity)
            } catch {}
            const leaves = [...leaves1, ...leaves2]
            for (const leaf of leaves) {
              bump(raw, leaf.name + (leaf.unit ? ` (${leaf.unit})` : ''), dayIdx, leaf.qty)
            }
          }
        } catch {}
      }
    }

    // Compute C-Total
    const proteinsCTotal = zero()
    for (const [code, arr] of Object.entries(proteins)) {
      if (code.toUpperCase().startsWith('C')) {
        arr.forEach((n, i) => proteinsCTotal[i] += n)
      }
    }

    const rawFlag = (url.searchParams.get('raw') || '1') === '1'
    return new NextResponse(JSON.stringify({
      days: dayKeys,
      products,
      addons,
      cold: rawFlag ? {} : cold,
      hot: rawFlag ? {} : hot,
      desserts: rawFlag ? {} : desserts,
      proteins,
      proteinsCTotal,
      sw,
      raw: rawFlag ? raw : undefined
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (e) {
    console.error('Error in stock summary:', e)
    return NextResponse.json({ error: 'Failed to build stock summary' }, { status: 500 })
  }
}

