// One-off follow-up to scripts/dedupe-variant-base-lines.ts (26 Aug 2026).
//
// 1. Korean Taco Station variants should only carry protein + serveware lines
//    (per Peter: the base list owns tacos, kimchi, lettuce, box, inserts), so
//    the redundant per-variant "Lettuce - 75" line is removed. The base list's
//    "Large Lettuce - 75" stays.
//
// 2. The Other catalogue holds 14 identical "Slider Bread" rows ($20.66,
//    Golden Kit Bakehouse). Keep one canonical row, repoint every reference
//    (recipe JSON in six tables + IngredientSupplierLink), then delete the
//    rest. If a repoint leaves the same line twice in one recipe, the
//    quantities are combined so costs are unchanged.
//
//   npx tsx scripts/fix-ktk-lettuce-and-slider-bread.ts          # dry run
//   npx tsx scripts/fix-ktk-lettuce-and-slider-bread.ts --apply

import { prisma } from '../src/lib/prisma'
import { recalcAll } from '../src/lib/pricing/recalc'

const APPLY = process.argv.includes('--apply')

type RawLine = Record<string, unknown>

const normName = (v: unknown) =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const sourceOf = (l: RawLine) => String(l.source ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')

async function removeKtkLettuce() {
  const variants = await prisma.productVariant.findMany({
    where: { shopifySku: { startsWith: 'KTK20' } },
    select: { id: true, shopifySku: true, ingredients: true },
  })
  let changed = 0
  for (const v of variants) {
    const own = Array.isArray(v.ingredients) ? (v.ingredients as RawLine[]) : []
    const kept = own.filter((l) => normName(l.name) !== 'lettuce 75')
    if (kept.length === own.length) continue
    changed++
    console.log(`${APPLY ? 'FIX' : 'DRY'} ${v.shopifySku}: removing variant "Lettuce - 75" line, keeping ${kept.length}`)
    if (APPLY) {
      await prisma.productVariant.update({ where: { id: v.id }, data: { ingredients: kept as object[] } })
    }
  }
  console.log(`Lettuce: ${changed} variants ${APPLY ? 'updated' : 'would update'}.`)
}

async function mergeSliderBread() {
  const dupes = await prisma.otherProduct.findMany({
    where: { name: { equals: 'Slider Bread', mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, supplier: true, cost: true, createdAt: true },
  })
  if (dupes.length <= 1) {
    console.log('Slider Bread: nothing to merge.')
    return
  }
  const costs = new Set(dupes.map((d) => d.cost))
  const suppliers = new Set(dupes.map((d) => d.supplier))
  if (costs.size > 1 || suppliers.size > 1) {
    console.log('Slider Bread rows differ in cost/supplier — aborting merge for safety:', dupes)
    return
  }
  const canonical = dupes[0]
  const dupeIds = new Set(dupes.slice(1).map((d) => d.id))
  console.log(`Slider Bread: keeping ${canonical.id} (oldest), merging ${dupeIds.size} duplicates.`)

  // Repoint recipe JSON. A line references an Other row via source 'Other' + id.
  const repointLines = (lines: RawLine[]): { lines: RawLine[]; touched: boolean } => {
    let touched = false
    const mapped = lines.map((l) => {
      if (sourceOf(l) === 'other' && dupeIds.has(String(l.id ?? ''))) {
        touched = true
        return { ...l, id: canonical.id }
      }
      return l
    })
    if (!touched) return { lines, touched }
    // Combine lines that became identical references so totals are unchanged.
    const out: RawLine[] = []
    for (const l of mapped) {
      const prior = out.find(
        (o) => sourceOf(o) === sourceOf(l) && String(o.id ?? '') === String(l.id ?? '') && String(l.id ?? '') !== ''
      )
      if (prior && sourceOf(l) === 'other' && String(l.id) === canonical.id) {
        prior.quantity = Number(prior.quantity ?? 1) + Number(l.quantity ?? 1)
      } else {
        out.push(l)
      }
    }
    return { lines: out, touched }
  }

  const jsonStores: Array<{
    label: string
    rows: () => Promise<Array<{ id: string; lines: unknown }>>
    save: (id: string, lines: RawLine[]) => Promise<unknown>
  }> = [
    {
      label: 'Component.ingredients',
      rows: async () => (await prisma.component.findMany({ select: { id: true, ingredients: true } })).map((r) => ({ id: r.id, lines: r.ingredients })),
      save: (id, lines) => prisma.component.update({ where: { id }, data: { ingredients: lines as object[] } }),
    },
    {
      label: 'Product.ingredients',
      rows: async () => (await prisma.product.findMany({ select: { id: true, ingredients: true } })).map((r) => ({ id: r.id, lines: r.ingredients })),
      save: (id, lines) => prisma.product.update({ where: { id }, data: { ingredients: lines as object[] } }),
    },
    {
      label: 'ProductCustomData.ingredients',
      rows: async () => (await prisma.productCustomData.findMany({ select: { id: true, ingredients: true } })).map((r) => ({ id: r.id, lines: r.ingredients })),
      save: (id, lines) => prisma.productCustomData.update({ where: { id }, data: { ingredients: lines as object[] } }),
    },
    {
      label: 'ProductWithCustomData.ingredients',
      rows: async () => (await prisma.productWithCustomData.findMany({ select: { id: true, ingredients: true } })).map((r) => ({ id: r.id, lines: r.ingredients })),
      save: (id, lines) => prisma.productWithCustomData.update({ where: { id }, data: { ingredients: lines as object[] } }),
    },
    {
      label: 'ShopifyProduct.baseIngredients',
      rows: async () => (await prisma.shopifyProduct.findMany({ select: { id: true, baseIngredients: true } })).map((r) => ({ id: r.id, lines: r.baseIngredients })),
      save: (id, lines) => prisma.shopifyProduct.update({ where: { id }, data: { baseIngredients: lines as object[] } }),
    },
    {
      label: 'ProductVariant.ingredients',
      rows: async () => (await prisma.productVariant.findMany({ select: { id: true, ingredients: true } })).map((r) => ({ id: r.id, lines: r.ingredients })),
      save: (id, lines) => prisma.productVariant.update({ where: { id }, data: { ingredients: lines as object[] } }),
    },
  ]

  for (const store of jsonStores) {
    let touchedCount = 0
    for (const row of await store.rows()) {
      if (!Array.isArray(row.lines)) continue
      const { lines, touched } = repointLines(row.lines as RawLine[])
      if (!touched) continue
      touchedCount++
      if (APPLY) await store.save(row.id, lines)
    }
    if (touchedCount) console.log(`${APPLY ? 'FIX' : 'DRY'} ${store.label}: ${touchedCount} rows repointed`)
  }

  // Ingredient master links pointing at a duplicate row.
  const links = await prisma.ingredientSupplierLink.findMany({
    where: { source: 'Other', sourceId: { in: [...dupeIds] } },
    select: { id: true, ingredientId: true },
  })
  for (const link of links) {
    const existing = await prisma.ingredientSupplierLink.findFirst({
      where: { ingredientId: link.ingredientId, source: 'Other', sourceId: canonical.id },
      select: { id: true },
    })
    if (existing) {
      console.log(`${APPLY ? 'FIX' : 'DRY'} link ${link.id}: canonical link already exists — moving price points and deleting`)
      if (APPLY) {
        await prisma.pricePoint.updateMany({ where: { linkId: link.id }, data: { linkId: existing.id } })
        await prisma.ingredientSupplierLink.delete({ where: { id: link.id } })
      }
    } else {
      console.log(`${APPLY ? 'FIX' : 'DRY'} link ${link.id}: repointing sourceId to canonical`)
      if (APPLY) {
        await prisma.ingredientSupplierLink.update({ where: { id: link.id }, data: { sourceId: canonical.id } })
      }
    }
  }
  if (!links.length) console.log('No ingredient supplier links referenced the duplicates.')

  if (APPLY) {
    const deleted = await prisma.otherProduct.deleteMany({ where: { id: { in: [...dupeIds] } } })
    console.log(`Deleted ${deleted.count} duplicate Slider Bread rows.`)
  } else {
    console.log(`Would delete ${dupeIds.size} duplicate Slider Bread rows.`)
  }
}

async function main() {
  await removeKtkLettuce()
  console.log('')
  await mergeSliderBread()
  if (APPLY) {
    console.log('\nRecalculating costs…')
    const report = await recalcAll('ktk-lettuce-slider-bread-fix')
    console.log(`Recalc: ${report.components.updated} components, ${report.variants.updated} variants updated, coverage ${(report.coveragePct * 100).toFixed(1)}%`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
