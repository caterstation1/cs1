import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLocalDate } from '@/lib/date-utils'
import { buildComponentMap, expandToRawLeaves } from '@/lib/components-expander'
import { isWellingtonOrder } from '@/lib/region'

function toDayKey(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

// use centralized region detection

function resolveDayKey(order: any): string | null {
  if (order.deliveryDateResolved) {
    try { return toDayKey(new Date(order.deliveryDateResolved as any)) } catch {}
  }
  if (order.deliveryDate) {
    const d = parseLocalDate(String(order.deliveryDate)); if (d) return toDayKey(d)
  }
  const noteAttrs = order.noteAttributes || order.note_attributes || []
  const dateAttr = Array.isArray(noteAttrs) ? noteAttrs.find((a: any) => (a?.name || '').toLowerCase() === 'delivery date') : null
  if (dateAttr && dateAttr.value) {
    const d = parseLocalDate(String(dateAttr.value)); if (d) return toDayKey(d)
  }
  if (order.tags) {
    const m = String(order.tags).match(/\b\w{3}\s\w{3}\s\d{2}\s\d{4}\b/); if (m) {
      const d = parseLocalDate(m[0]); if (d) return toDayKey(d)
    }
  }
  if (order.createdAt) {
    try { return toDayKey(new Date(order.createdAt as any)) } catch {}
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const city = (url.searchParams.get('city') || 'AKL').toUpperCase()
    const days = Math.min(7, Math.max(1, parseInt(url.searchParams.get('days') || '2', 10)))
    const debug = url.searchParams.get('debug') === '1'
    const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const end = new Date(start); end.setDate(end.getDate()+days)

    // Fetch relevant orders (resolved range + recent unresolved)
    const ordersResolved = await prisma.order.findMany({
      where: {
        deliveryDateResolved: {
          gte: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          lt: new Date(end.getFullYear(), end.getMonth(), end.getDate())
        }
      },
      orderBy: { deliveryDateResolved: 'asc' }
    })
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
    const allOrders = [...ordersResolved, ...ordersUnresolved]
      .filter(o => city === 'WLG' ? isWellingtonOrder(o) : !isWellingtonOrder(o))
      .filter(o => {
        const dk = resolveDayKey(o); if (!dk) return false
        const d = parseLocalDate(dk); if (!d) return false
        return d >= start && d < end
      })

    // Gather line items and variants (for ingredients)
    const lineItems: any[] = []
    const variantIdsSet = new Set<string>()
    for (const o of allOrders) {
      let items: any[] = []
      if (Array.isArray(o.lineItems)) items = o.lineItems as any[]
      else if (typeof o.lineItems === 'string') { try { items = JSON.parse(o.lineItems) } catch {} }
      for (const it of items) {
        lineItems.push(it)
        const vId = String(it.variant_id ?? it.variantId ?? '')
        if (vId) variantIdsSet.add(vId)
      }
    }
    let variantIds = Array.from(variantIdsSet)
    let variants = await prisma.productVariant.findMany({
      where: { variantId: { in: variantIds } },
      include: { product: { select: { baseIngredients: true, isPartyPackDefault: true, bundleDefaultItems: true } } }
    })
    const byId = new Map(variants.map(v => [v.variantId, v]))
    // Load pack children once
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
    const missingChildIds = Array.from(childIds).filter(id => !byId.has(id))
    if (missingChildIds.length) {
      const children = await prisma.productVariant.findMany({
        where: { variantId: { in: missingChildIds } },
        include: { product: { select: { baseIngredients: true, isPartyPackDefault: true, bundleDefaultItems: true } } }
      })
      children.forEach(v => byId.set(v.variantId, v))
      variants = [...variants, ...children]
    }

    // Load all components for raw expansion
    const components = await prisma.component.findMany({ select: { id: true, name: true, ingredients: true } })
    const compMap = buildComponentMap(components as any)

    // Aggregate required RAW ingredient quantities for next 2 days
    const contrib: Map<string, Array<{ source: string; name: string; unit?: string; qty: number }>> = new Map()
    const requiredByKey: Map<string, { name: string; unit?: string; qty: number }> = new Map()
    for (const it of lineItems) {
      const qty = Math.max(1, parseInt(String(it.quantity || '1'), 10))
      const variantId = String(it.variant_id ?? it.variantId ?? '')
      const v = byId.get(variantId)
      if (!v) continue

      const varIngs: any[] = Array.isArray(v.ingredients) ? v.ingredients as any[] : []
      const leaves1 = expandToRawLeaves(compMap, varIngs, qty)
      let baseLeaves: any[] = []
      try {
        const bi = v.product?.baseIngredients
        const baseIngs: any[] = Array.isArray(bi) ? bi as any[] : (bi ? JSON.parse(String(bi)) : [])
        baseLeaves = expandToRawLeaves(compMap, baseIngs, qty)
      } catch {}
      const allLeaves = [...leaves1, ...baseLeaves]
      for (const leaf of allLeaves) {
        const k = `${leaf.id || leaf.name.toLowerCase()}::${leaf.unit || ''}`
        const prev = requiredByKey.get(k)
        if (prev) prev.qty += leaf.qty
        else requiredByKey.set(k, { name: leaf.name, unit: leaf.unit, qty: leaf.qty })
        if (debug) {
          const arr = contrib.get(k) || []
          arr.push({ source: String(it.title || it.name || v.shopifyName || v.shopifyTitle || 'Item'), name: leaf.name, unit: leaf.unit, qty: leaf.qty })
          contrib.set(k, arr)
        }
      }
    }

    // Supplier catalogs
    const others = await prisma.otherProduct.findMany()
    const gils = await prisma.gilmoursProduct.findMany()
    const bids = await prisma.bidfoodProduct.findMany()

    const suggestions: Array<{ id: string; name: string; sku?: string; supplier: string; requiredQty: number; unit?: string; breakdown?: Array<{ source: string; name: string; unit?: string; qty: number }> }> = []
    for (const [_k, rec] of requiredByKey.entries()) {
      const keyLower = rec.name.toLowerCase()
      const displayName = others.find(o => (o.name || '').toLowerCase() === keyLower)?.name
        || rec.name
      // Mapping priority: OtherProduct exact -> Gilmours(desc contains or sku equals) -> Bidfood(desc contains or code equals)
      let supplier = 'Other'
      let sku: string | undefined = undefined

      const otherMatch = others.find(o => (o.name || '').toLowerCase() === keyLower)
      if (otherMatch) {
        supplier = otherMatch.supplier || 'Other'
        sku = undefined
      } else {
        const gilExactSku = gils.find(g => String(g.sku || '').toLowerCase() === keyLower)
        const gilDesc = gilExactSku || gils.find(g => (g.description || '').toLowerCase().includes(keyLower))
        if (gilDesc) {
          supplier = 'Gilmours'
          sku = gilDesc.sku
        } else {
          const bidCode = bids.find(b => String(b.productCode || '').toLowerCase() === keyLower)
          const bidDesc = bidCode || bids.find(b => (b.description || '').toLowerCase().includes(keyLower))
          if (bidDesc) {
            supplier = 'Bidfood'
            sku = String(bidDesc.productCode)
          }
        }
      }

      const sug = {
        id: `${supplier}:${sku || displayName}${rec.unit ? ':' + rec.unit : ''}`,
        name: displayName,
        sku,
        supplier,
        requiredQty: rec.qty,
        unit: rec.unit
      } as any
      if (debug) {
        const arr = contrib.get(_k) || []
        sug.breakdown = arr.sort((a, b) => b.qty - a.qty)
      }
      suggestions.push(sug)
    }

    suggestions.sort((a, b) => b.requiredQty - a.requiredQty)

    return NextResponse.json(suggestions, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('cart suggest error', e)
    return NextResponse.json({ error: 'Failed to build suggestions' }, { status: 500 })
  }
}

