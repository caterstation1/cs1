import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate, createLocalDate } from '@/lib/date-utils'

function parseLineItems(li: any): any[] {
  if (Array.isArray(li)) return li
  if (typeof li === 'string') {
    try { return JSON.parse(li) } catch {}
  }
  return []
}

function getPeriodRange(period: string): { startStr: string; endStr: string } {
  const today = getTodayLocal()
  const todayStr = formatLocalDate(today)
  if (period === 'today') return { startStr: todayStr, endStr: todayStr }
  if (period === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    const ys = formatLocalDate(y)
    return { startStr: ys, endStr: ys }
  }
  if (period === 'week') {
    const startOfWeek = new Date(today)
    const dow = today.getDay()
    const daysToMonday = dow === 0 ? 6 : dow - 1
    startOfWeek.setDate(today.getDate() - daysToMonday)
    return { startStr: formatLocalDate(startOfWeek), endStr: todayStr }
  }
  if (period === 'month') {
    const som = createLocalDate(today.getFullYear(), today.getMonth() + 1, 1)
    return { startStr: formatLocalDate(som), endStr: todayStr }
  }
  if (period === 'year') {
    const soy = createLocalDate(today.getFullYear(), 1, 1)
    return { startStr: formatLocalDate(soy), endStr: todayStr }
  }
  return { startStr: todayStr, endStr: todayStr }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') || 'today').toLowerCase()
    const qStart = (searchParams.get('start') || '').trim()
    const qEnd = (searchParams.get('end') || '').trim()
    let { startStr, endStr } = getPeriodRange(period)
    if (/^\d{4}-\d{2}-\d{2}$/.test(qStart)) {
      startStr = qStart
      endStr = /^\d{4}-\d{2}-\d{2}$/.test(qEnd) ? qEnd : qStart
    }

    // Orders in Out-the-Door range (by deliveryDate)
    const orders = await prisma.order.findMany({
      where: {
        AND: [
          { deliveryDate: { gte: startStr } },
          { deliveryDate: { lte: endStr } }
        ]
      },
      select: { id: true, orderNumber: true, lineItems: true }
    })

    // Collect Variant IDs and SKUs for cost lookup (prefer variantId)
    const allLineItems = orders.flatMap(o => parseLineItems(o.lineItems))
    const variantIds = Array.from(new Set(
      allLineItems.map((li: any) => li?.variant_id || li?.variantId).filter(Boolean).map(String)
    )) as string[]
    const skus = Array.from(new Set(
      allLineItems.map((li: any) => li?.sku).filter(Boolean).map(String)
    )) as string[]

    // Lookup variant costs by SKU with legacy fallback
    // Fetch by variantId (primary) and by sku (fallback)
    const variantsById = variantIds.length ? await prisma.productVariant.findMany({
      where: { variantId: { in: variantIds } },
      select: {
        variantId: true,
        shopifySku: true,
        shopifyName: true,
        shopifyTitle: true,
        totalCost: true,
        ingredients: true,
        product: { select: { baseIngredients: true, productTitle: true } }
      }
    }) : []
    const variantsBySku = skus.length ? await prisma.productVariant.findMany({
      where: { shopifySku: { in: skus } },
      select: {
        shopifySku: true,
        variantId: true,
        shopifyName: true,
        shopifyTitle: true,
        totalCost: true,
        ingredients: true,
        product: { select: { baseIngredients: true, productTitle: true } }
      }
    }) : []
    const allVariants = [...variantsById, ...variantsBySku]
    const missingVariantIds = allVariants
      .filter(v => !(typeof v.totalCost === 'number') || !isFinite(Number(v.totalCost)) || Number(v.totalCost) === 0)
      .map(v => v.variantId)
    const legacy = missingVariantIds.length ? await prisma.productWithCustomData.findMany({
      where: { variantId: { in: Array.from(new Set(missingVariantIds)) } },
      select: { variantId: true, totalCost: true }
    }) : []
    const legacyCostByVariantId = new Map<string, number>(legacy.map(l => [String(l.variantId), Number(l.totalCost || 0)]))
    // Calculate combined cost from base + variant ingredients when available
    const calcTotal = (ings: any[]): number => {
      if (!Array.isArray(ings)) return 0
      return Number(ings.reduce((s, ing) => {
        const q = Number(ing?.quantity || 0)
        const c = Number(ing?.cost || 0)
        return s + (isFinite(q) && isFinite(c) ? q * c : 0)
      }, 0).toFixed(2))
    }
    const bySku = new Map<string, { variantId: string; name: string; unitCost: number; productTitle?: string; variantTitle?: string }>()
    const byVariantId = new Map<string, { sku?: string; name: string; unitCost: number; productTitle?: string; variantTitle?: string }>()
    for (const v of allVariants as any[]) {
      const base = Array.isArray(v.product?.baseIngredients) ? v.product.baseIngredients : []
      const varIngs = Array.isArray(v.ingredients) ? v.ingredients : []
      const combinedCost = calcTotal([...base, ...varIngs])
      const fallback = legacyCostByVariantId.get(String(v.variantId)) || 0
      const primary = Number(v.totalCost || 0)
      // Prefer computed combined if > 0, else variant.totalCost, else legacy
      const unitCost = combinedCost > 0 ? combinedCost : (primary > 0 ? primary : fallback)
      const payload = {
        variantId: String(v.variantId),
        name: v.shopifyName,
        unitCost,
        productTitle: v.product?.productTitle,
        variantTitle: v.shopifyName
      }
      if (v.shopifySku) bySku.set(String(v.shopifySku), payload)
      byVariantId.set(String(v.variantId), { sku: v.shopifySku, ...payload })
    }

    // Build breakdown items
    const items: Array<{
      orderNumber: number
      sku: string
      variantId: string | null
      name: string
      quantity: number
      unitCost: number
      lineCost: number
      productTitle?: string
      variantTitle?: string
    }> = []

    for (const o of orders) {
      const lis = parseLineItems(o.lineItems)
      for (const li of lis) {
        const sku = String(li?.sku || '')
        const variantId = String(li?.variant_id || li?.variantId || '')
        if (!sku && !variantId) continue
        const qty = Number(li?.quantity || 0)
        const meta = (variantId && byVariantId.get(variantId)) || (sku && bySku.get(sku))
        const unitCost = Number((meta as any)?.unitCost || 0)
        items.push({
          orderNumber: Number(o.orderNumber || 0),
          sku,
          variantId: (meta as any)?.variantId || (variantId || null),
          name: String(li?.title || ((meta as any)?.name) || sku),
          quantity: qty,
          unitCost,
          lineCost: Number((qty * unitCost).toFixed(2)),
          productTitle: String(li?.title || (meta as any)?.productTitle || ''),
          variantTitle: (meta as any)?.variantTitle || String(li?.variant_title || li?.variantTitle || '')
        })

        // If the order line carries bundle children, include them explicitly for transparency
        const children: any[] = Array.isArray(li?.bundle_children) ? li.bundle_children
          : (Array.isArray(li?.children) ? li.children : [])
        if (children.length > 0) {
          for (const ch of children) {
            const cSku = String(ch?.sku || '')
            const cVarId = String(ch?.variant_id || ch?.variantId || '')
            const cQty = Number(ch?.quantity || 0)
            const cMeta = (cVarId && byVariantId.get(cVarId)) || (cSku && bySku.get(cSku))
            const cUnit = Number((cMeta as any)?.unitCost || 0)
            items.push({
              orderNumber: Number(o.orderNumber || 0),
              sku: cSku,
              variantId: (cMeta as any)?.variantId || (cVarId || null),
              name: String(ch?.title || (cMeta as any)?.name || cSku),
              quantity: cQty,
              unitCost: cUnit,
              lineCost: Number((cQty * cUnit).toFixed(2)),
              productTitle: String(ch?.title || ''),
              variantTitle: String(ch?.variant_title || '')
            })
          }
        }
      }
    }

    // Sort by line cost desc
    items.sort((a, b) => b.lineCost - a.lineCost)

    const totals = {
      items: items.length,
      totalCost: Number(items.reduce((s, it) => s + it.lineCost, 0).toFixed(2))
    }

    return NextResponse.json({ period, start: startStr, end: endStr, items, totals })
  } catch (e) {
    console.error('❌ Cost breakdown error:', e)
    return NextResponse.json({ error: 'Failed to load cost breakdown' }, { status: 500 })
  }
}

