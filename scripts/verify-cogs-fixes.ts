/**
 * Compares the old dashboard COGS logic against the new shared engine so the
 * effect of each fix (party packs, live pricing, cancelled orders, delivery
 * basis) can be seen as a number rather than taken on trust.
 *
 *   npx tsx scripts/verify-cogs-fixes.ts
 */
import { PrismaClient } from '../src/generated/prisma'
import { buildCogsIndex, lineItemRefs, revenueExGst, round2, sumOrderCogs, parseLineItems } from '../src/lib/cogs'

const prisma = new PrismaClient()

const utcMidnight = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

function nzToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date())
}

/** The previous logic: frozen recipe JSON preferred, no bundle expansion. */
function oldUnitCost(v: any): number {
  const calc = (rows: any) =>
    Array.isArray(rows)
      ? rows.reduce((s: number, r: any) => s + Number(r?.quantity || 0) * Number(r?.cost || 0), 0)
      : 0
  const combined = calc(v?.product?.baseIngredients) + calc(v?.ingredients)
  return combined > 0 ? combined : Number(v?.totalCost || 0)
}

async function main() {
  const today = nzToday()
  const yearStart = `${today.slice(0, 4)}-01-01`

  const all = await prisma.order.findMany({
    where: { deliveryDateResolved: { gte: utcMidnight(yearStart), lte: utcMidnight(today) } },
    select: { orderNumber: true, totalPrice: true, lineItems: true, cancelledAt: true },
  })
  const live = all.filter((o) => !o.cancelledAt)
  const cancelled = all.filter((o) => o.cancelledAt)

  const refs = lineItemRefs(all)
  const index = await buildCogsIndex(refs.variantIds, refs.skus)

  // Old-style index for comparison
  const oldVariants = await prisma.productVariant.findMany({
    where: { OR: [{ variantId: { in: refs.variantIds } }, { shopifySku: { in: refs.skus } }] },
    select: {
      variantId: true,
      shopifySku: true,
      totalCost: true,
      ingredients: true,
      product: { select: { baseIngredients: true } },
    },
  })
  const oldById = new Map<string, number>()
  const oldBySku = new Map<string, number>()
  for (const v of oldVariants) {
    const c = oldUnitCost(v)
    oldById.set(v.variantId, c)
    if (v.shopifySku) oldBySku.set(v.shopifySku, c)
  }
  const oldCogs = (orders: typeof all) => {
    let t = 0
    for (const o of orders) {
      for (const li of parseLineItems(o.lineItems)) {
        const qty = Number(li?.quantity || 0)
        const vId = String(li?.variant_id || li?.variantId || '')
        const sku = String(li?.sku || '')
        const unit = (vId ? oldById.get(vId) : undefined) ?? (sku ? oldBySku.get(sku) : undefined) ?? 0
        t += qty * unit
      }
    }
    return round2(t)
  }

  const newTotals = live.reduce(
    (acc, o) => {
      const r = sumOrderCogs(o, index)
      acc.cogs += r.cogs
      acc.missingQty += r.missingQty
      acc.totalQty += r.totalQty
      acc.revenue += revenueExGst(o)
      return acc
    },
    { cogs: 0, missingQty: 0, totalQty: 0, revenue: 0 }
  )

  const bundleEntries = Array.from(index.byVariantId.values()).filter((e) => e.source === 'bundle')
  const stillUncosted = Array.from(index.byVariantId.values()).filter((e) => e.source === 'none')

  console.log('=== YTD by delivery date ===')
  console.log('Orders (excl. cancelled):', live.length, '| cancelled dropped:', cancelled.length)
  console.log('Revenue ex GST:          ', round2(newTotals.revenue))
  console.log('COGS old logic (incl. cancelled):', oldCogs(all))
  console.log('COGS old logic (excl. cancelled):', oldCogs(live))
  console.log('COGS new engine:                 ', round2(newTotals.cogs))
  console.log(
    'GP%: old',
    (((newTotals.revenue - oldCogs(all)) / newTotals.revenue) * 100).toFixed(1),
    '-> new',
    (((newTotals.revenue - newTotals.cogs) / newTotals.revenue) * 100).toFixed(1)
  )
  console.log(
    'Cost coverage:',
    Math.round(((newTotals.totalQty - newTotals.missingQty) / newTotals.totalQty) * 100) + '%',
    `(${newTotals.missingQty} of ${newTotals.totalQty} units uncosted)`
  )

  console.log('\n=== Party packs now costed from contents ===')
  console.log('Bundle-costed variants:', bundleEntries.length)
  for (const e of bundleEntries.slice(0, 12)) {
    console.log(`  ${e.sku || e.variantId}  ${e.name}  $${e.unitCost}  (${e.children?.length ?? 0} items)`)
  }

  // Rank the gaps by how much they actually get sold, so the recipe backlog
  // can be worked highest-impact first.
  const soldUnits = new Map<string, number>()
  const soldRevenue = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const o of live) {
    const perOrder = Number(o.totalPrice || 0)
    for (const li of parseLineItems(o.lineItems)) {
      const vId = String(li?.variant_id || li?.variantId || '')
      const sku = String(li?.sku || '')
      const entry = (vId && index.byVariantId.get(vId)) || (sku && index.bySku.get(sku)) || null
      if (!entry || entry.source !== 'none') continue
      const key = entry.variantId
      const qty = Number(li?.quantity || 0)
      soldUnits.set(key, (soldUnits.get(key) || 0) + qty)
      soldRevenue.set(key, (soldRevenue.get(key) || 0) + Number(li?.price || 0) * qty)
      labels.set(key, `${entry.sku || ''}|${entry.productTitle}|${entry.name}`)
      void perOrder
    }
  }

  const ranked = Array.from(soldUnits.entries()).sort((a, b) => b[1] - a[1])
  console.log('\n=== Still uncosted, ranked by units sold YTD (the recipe backlog) ===')
  console.log('Variants with no resolvable cost:', stillUncosted.length, '| of those, sold YTD:', ranked.length)
  console.log('units  revenue     sku            product / variant')
  for (const [variantId, units] of ranked) {
    const [sku, product, name] = (labels.get(variantId) || '||').split('|')
    const rev = soldRevenue.get(variantId) || 0
    console.log(
      `${String(units).padStart(5)}  ${rev.toFixed(2).padStart(9)}  ${(sku || variantId).padEnd(14)} ${product} / ${name}`
    )
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
