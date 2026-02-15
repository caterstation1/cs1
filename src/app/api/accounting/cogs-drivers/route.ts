import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseRangePreset,
  parseLineItems,
  collectVariantCosts,
  shouldIncludeOrder,
} from '@/lib/accounting'

function toBool(v: string | null, def = false): boolean {
  if (v == null) return def
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rangePreset = (searchParams.get('rangePreset') || '30D') as any
    const includeCancelled = toBool(searchParams.get('includeCancelled'), false)
    const includeUnpaid = toBool(searchParams.get('includeUnpaid'), false)
    const useBusinessDate = toBool(searchParams.get('useBusinessDate'), true)
    const view = (searchParams.get('view') || 'products') as 'products' | 'ingredients'

    if (view === 'ingredients') {
      return NextResponse.json({ view, comingSoon: true, items: [] })
    }

    const { start, end } = parseRangePreset(rangePreset)
    const dateKey: any = useBusinessDate ? 'deliveryDateResolved' : 'createdAt'
    const where: any = { [dateKey]: { gte: start, lte: end } }
    if (!includeCancelled) where.cancelledAt = null
    if (!includeUnpaid) where.financialStatus = { in: ['paid', 'partially_paid'] }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { [dateKey]: 'asc' },
      select: {
        id: true,
        totalPrice: true,
        lineItems: true,
      },
    })

    const filtered = orders.filter(o => shouldIncludeOrder(o, { includeCancelled, includeUnpaid }))
    const allLis = filtered.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(allLis.map((it: any) => String(it?.variant_id || it?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allLis.map((it: any) => String(it?.sku || '')).filter(Boolean)))
    const maps = await collectVariantCosts(variantIds, skus)

    const nameByVariant = new Map<string, string>()
    if (variantIds.length > 0) {
      const vs = await prisma.productVariant.findMany({
        where: { variantId: { in: variantIds } },
        select: { variantId: true, shopifyName: true, product: { select: { displayName: true } } },
      })
      for (const v of vs) {
        const name = (v.product?.displayName?.trim() || v.shopifyName || '').toString()
        if (v.variantId && name) nameByVariant.set(String(v.variantId), name)
      }
    }

    const agg = new Map<string, { name: string; totalCogs: number; qty: number; revenue: number }>()
    for (const o of filtered) {
      const items = parseLineItems(o.lineItems)
      for (const li of items) {
        const qty = Number(li?.quantity || 0)
        const vId = String(li?.variant_id || li?.variantId || '')
        const sku = String(li?.sku || '')
        const unit = (vId && maps.byVariantId.get(vId)) ?? (sku && maps.bySku.get(sku)) ?? 0
        const name = (vId && nameByVariant.get(vId)) || String(li?.title || sku || vId || 'Unknown')
        const got = agg.get(name) || { name, totalCogs: 0, qty: 0, revenue: 0 }
        got.totalCogs += (isFinite(qty) ? qty : 0) * Number(unit)
        got.qty += isFinite(qty) ? qty : 0
        agg.set(name, got)
      }
    }

    const list = Array.from(agg.values())
    const totalCogsAll = list.reduce((s, x) => s + x.totalCogs, 0)
    list.sort((a, b) => b.totalCogs - a.totalCogs)
    const top = list.slice(0, 10).map(x => ({
      name: x.name,
      totalCogs: Number(x.totalCogs.toFixed(2)),
      percentOfTotal: totalCogsAll > 0 ? Number(((x.totalCogs / totalCogsAll) * 100).toFixed(1)) : 0,
      qty: x.qty,
    }))

    return NextResponse.json({ view, top, totalCogs: Number(totalCogsAll.toFixed(2)) })
  } catch (error) {
    console.error('❌ Error in cogs-drivers:', error)
    return NextResponse.json({ error: 'Failed to compute COGS drivers' }, { status: 500 })
  }
}

