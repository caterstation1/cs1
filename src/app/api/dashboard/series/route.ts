import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, createLocalDate, formatLocalDate, formatNZYMD } from '@/lib/date-utils'
import { requireRole } from '@/lib/authz'

function parseLineItems(li: any): any[] {
  if (Array.isArray(li)) return li
  if (typeof li === 'string') {
    try { return JSON.parse(li) } catch {}
  }
  return []
}

function calcTotal(ings: any[]): number {
  if (!Array.isArray(ings)) return 0
  return Number(ings.reduce((s, ing) => {
    const q = Number(ing?.quantity || 0)
    const c = Number(ing?.cost || 0)
    return s + (isFinite(q) && isFinite(c) ? q * c : 0)
  }, 0).toFixed(2))
}

function getDefaultRange(): { startStr: string; endStr: string } {
  const today = getTodayLocal()
  const endStr = formatLocalDate(today)
  const back = new Date(today)
  back.setDate(back.getDate() - 364) // inclusive of today -> 365 days
  const startStr = formatLocalDate(back)
  return { startStr, endStr }
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])

    const { searchParams } = new URL(req.url)
    const qStart = (searchParams.get('start') || '').trim()
    const qEnd = (searchParams.get('end') || '').trim()
    const def = getDefaultRange()
    const startStr = /^\d{4}-\d{2}-\d{2}$/.test(qStart) ? qStart : def.startStr
    const endStr = /^\d{4}-\d{2}-\d{2}$/.test(qEnd) ? qEnd : def.endStr

    // 1) Load orders by Out‑of‑Door (deliveryDate) within range
    const orders = await prisma.order.findMany({
      where: {
        AND: [
          { deliveryDate: { gte: startStr } },
          { deliveryDate: { lte: endStr } }
        ]
      }
    })

    // 2) Build variant cost maps (variantId primary, sku fallback)
    const allLis = orders.flatMap((o: any) => parseLineItems(o.lineItems))
    const children = allLis.flatMap((li: any) => {
      const kids = Array.isArray(li?.bundle_children) ? li.bundle_children
        : (Array.isArray(li?.children) ? li.children : [])
      return kids || []
    })
    const allForLookup = [...allLis, ...children]
    const variantIds = Array.from(new Set(allForLookup.map((li:any)=> String(li?.variant_id || li?.variantId || '')).filter(Boolean)))
    const skus = Array.from(new Set(allForLookup.map((li:any)=> String(li?.sku || '')).filter(Boolean)))

    const variantsById = variantIds.length ? await prisma.productVariant.findMany({
      where: { variantId: { in: variantIds } },
      select: {
        variantId: true,
        shopifySku: true,
        totalCost: true,
        ingredients: true,
        product: { select: { baseIngredients: true } }
      }
    }) : []
    const variantsBySku = skus.length ? await prisma.productVariant.findMany({
      where: { shopifySku: { in: skus } },
      select: {
        variantId: true,
        shopifySku: true,
        totalCost: true,
        ingredients: true,
        product: { select: { baseIngredients: true } }
      }
    }) : []
    const allVariants = [...variantsById, ...variantsBySku]

    const byVariantId = new Map<string, number>()
    const bySku = new Map<string, number>()
    for (const v of allVariants as any[]) {
      const base = Array.isArray(v.product?.baseIngredients) ? v.product.baseIngredients : []
      const varIngs = Array.isArray(v.ingredients) ? v.ingredients : []
      const combined = calcTotal([...base, ...varIngs])
      const primary = Number(v.totalCost || 0)
      const unitCost = combined > 0 ? combined : primary
      byVariantId.set(String(v.variantId), unitCost)
      if (v.shopifySku) bySku.set(String(v.shopifySku), unitCost)
    }

    const sumItems = (items: any[]): number => {
      let total = 0
      for (const li of items) {
        const qty = Number(li?.quantity || 0)
        const vId = String(li?.variant_id || li?.variantId || '')
        const sku = String(li?.sku || '')
        const unit = (vId && byVariantId.get(vId)) ?? (sku && bySku.get(sku)) ?? 0
        total += (isFinite(qty) && isFinite(Number(unit)) ? qty * Number(unit) : 0)
      }
      return total
    }

    // 3) Bucket orders by deliveryDate
    const daily = new Map<string, {
      salesIncGst: number; salesExGst: number; costOfSales: number; ordersCount: number
    }>()
    for (const o of orders as any[]) {
      const date = String(o.deliveryDate || '').trim()
      if (!date) continue
      const tot = Number(o.totalPrice)
      const inc = isFinite(tot) ? tot : 0
      const ex = inc / 1.15
      const items = parseLineItems(o.lineItems)
      const kids = items.flatMap((li:any) => {
        const arr = Array.isArray(li?.bundle_children) ? li.bundle_children
          : (Array.isArray(li?.children) ? li.children : [])
        return arr || []
      })
      const cogs = sumItems(items) + sumItems(kids)
      const prev = daily.get(date) || { salesIncGst: 0, salesExGst: 0, costOfSales: 0, ordersCount: 0 }
      prev.salesIncGst += inc
      prev.salesExGst += ex
      prev.costOfSales += cogs
      prev.ordersCount += 1
      daily.set(date, prev)
    }

    // 4) Load staff costs and bucket per local day
    const startDate = createLocalDate(Number(startStr.slice(0,4)), Number(startStr.slice(5,7)), Number(startStr.slice(8,10)))
    const endDate = createLocalDate(Number(endStr.slice(0,4)), Number(endStr.slice(5,7)), Number(endStr.slice(8,10)))
    const shifts = await prisma.shift.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { staff: true }
    })
    const staffDaily = new Map<string, number>()
    for (const s of shifts as any[]) {
      // Bucket by NZ-local calendar day to avoid UTC shifts
      const d = formatNZYMD(new Date(s.date))
      const pay = Number(s?.staff?.payRate || 0)
      let hours = typeof s.totalHours === 'number' ? s.totalHours : null
      if (hours == null) {
        if (s.clockIn && s.clockOut) {
          const diffMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()
          hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0
        } else {
          hours = 0
        }
      }
      const cost = pay * (hours || 0)
      staffDaily.set(d, (staffDaily.get(d) || 0) + cost)
    }

    // 5) Build series from start..end inclusive to ensure contiguous dates
    const series: any[] = []
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      // Build NZ-local day key consistently
      const ds = formatNZYMD(cursor)
      const d = daily.get(ds) || { salesIncGst: 0, salesExGst: 0, costOfSales: 0, ordersCount: 0 }
      const staffCosts = staffDaily.get(ds) || 0
      const gp = d.salesExGst - d.costOfSales
      const gpPct = d.salesExGst > 0 ? (gp / d.salesExGst) * 100 : 0
      const gpWithStaff = d.salesExGst - d.costOfSales - staffCosts
      const gpWithStaffPct = d.salesExGst > 0 ? (gpWithStaff / d.salesExGst) * 100 : 0
      series.push({
        date: ds,
        salesIncGst: Number(d.salesIncGst.toFixed(2)),
        salesExGst: Number(d.salesExGst.toFixed(2)),
        costOfSales: Number(d.costOfSales.toFixed(2)),
        staffCosts: Number(staffCosts.toFixed(2)),
        ordersCount: d.ordersCount,
        gp: Number(gp.toFixed(2)),
        gpPct: Number(gpPct.toFixed(1)),
        gpWithStaff: Number(gpWithStaff.toFixed(2)),
        gpWithStaffPct: Number(gpWithStaffPct.toFixed(1))
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return NextResponse.json({ start: startStr, end: endStr, days: series })
  } catch (e: any) {
    const status = e?.status === 403 ? 403 : 500
    const msg = status === 403 ? 'Forbidden' : 'Failed to build series'
    if (status !== 403) console.error('❌ series error:', e)
    return NextResponse.json({ error: msg }, { status })
  }
}

