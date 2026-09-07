// Removes variant recipe lines that duplicate the product's shared base list.
//
// The pricing engine costs a variant as baseIngredients + variant ingredients.
// On a few station products someone authored the base list and then gave each
// variant a complete standalone list, so overlapping lines were counted twice
// (found via KTK20-BBY, where Recipe Builder showed 14 lines against the
// Products page's 8).
//
// Rule: a line is removed from the VARIANT's own list when the base list has a
// line with the same source + id + quantity. The shared base is never touched
// (276 variants depend on it), and overlaps with differing quantities do not
// exist in the data (verified 26 Aug 2026) — if one ever appears it is left
// alone and reported.
//
// Near-misses (base and variant lines pointing at different components with
// similar names, e.g. "Large Lettuce - 75" vs "Lettuce - 75") are reported for
// human review, never auto-changed.
//
//   npx tsx scripts/dedupe-variant-base-lines.ts          # dry run
//   npx tsx scripts/dedupe-variant-base-lines.ts --apply  # write + recalc

import { prisma } from '../src/lib/prisma'
import { recalcAll } from '../src/lib/pricing/recalc'

const APPLY = process.argv.includes('--apply')

type RawLine = Record<string, unknown>

const idOf = (l: RawLine): string =>
  String(l.id ?? l.sku ?? l.productCode ?? l.code ?? '').trim()
const sourceOf = (l: RawLine): string =>
  String(l.source ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
const qtyOf = (l: RawLine): number => {
  const q = Number(l.quantity ?? 1)
  return Number.isFinite(q) ? q : 1
}
const keyOf = (l: RawLine): string | null => {
  const id = idOf(l)
  const source = sourceOf(l)
  return id && source ? `${source}:${id}` : null
}
const nameOf = (l: RawLine): string => String(l.name ?? '').trim()

const normName = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

async function main() {
  const products = await prisma.shopifyProduct.findMany({
    select: {
      id: true,
      productTitle: true,
      baseIngredients: true,
      variants: { select: { id: true, shopifySku: true, shopifyName: true, ingredients: true } },
    },
  })

  let variantsChanged = 0
  let linesRemoved = 0
  const nearMisses: string[] = []

  for (const product of products) {
    const base = Array.isArray(product.baseIngredients) ? (product.baseIngredients as RawLine[]) : []
    if (!base.length) continue
    const baseByKey = new Map<string, RawLine>()
    for (const line of base) {
      const key = keyOf(line)
      if (key) baseByKey.set(key, line)
    }

    for (const variant of product.variants) {
      const own = Array.isArray(variant.ingredients) ? (variant.ingredients as RawLine[]) : []
      if (!own.length) continue

      const kept: RawLine[] = []
      const removed: RawLine[] = []
      for (const line of own) {
        const key = keyOf(line)
        const baseLine = key ? baseByKey.get(key) : undefined
        if (baseLine && Math.abs(qtyOf(baseLine) - qtyOf(line)) < 1e-9) {
          removed.push(line)
          continue
        }
        if (baseLine) {
          kept.push(line)
          nearMisses.push(
            `QTY DIFFERS (kept): ${variant.shopifySku ?? variant.shopifyName} | ${nameOf(line)} base qty ${qtyOf(baseLine)} vs variant qty ${qtyOf(line)}`
          )
          continue
        }
        // Same catalogue source, identical name and quantity but a different
        // row id — the Other tab holds duplicated rows (e.g. 14 identical
        // "Slider Bread" entries), so base and variant can reference the same
        // item through different ids. Still a double count; still removed.
        const nameDup = base.find(
          (b) =>
            sourceOf(b) === sourceOf(line) &&
            normName(nameOf(b)) === normName(nameOf(line)) &&
            normName(nameOf(line)) !== '' &&
            Math.abs(qtyOf(b) - qtyOf(line)) < 1e-9
        )
        if (nameDup) {
          removed.push(line)
          continue
        }
        kept.push(line)
      }

      // Different components with near-identical names across base and own —
      // e.g. base "Large Lettuce - 75" vs variant "Lettuce - 75". Report only.
      for (const line of kept) {
        const ln = normName(nameOf(line))
        if (!ln) continue
        for (const baseLine of base) {
          if (keyOf(baseLine) === keyOf(line)) continue
          const bn = normName(nameOf(baseLine))
          if (bn && (bn.includes(ln) || ln.includes(bn))) {
            nearMisses.push(
              `REVIEW: ${variant.shopifySku ?? variant.shopifyName} | variant line "${nameOf(line)}" vs base line "${nameOf(baseLine)}" — both will be costed`
            )
          }
        }
      }

      if (!removed.length) continue
      variantsChanged += 1
      linesRemoved += removed.length
      console.log(
        `${APPLY ? 'FIX' : 'DRY'} ${variant.shopifySku ?? variant.shopifyName} (${product.productTitle}): removing ${removed.length} duplicated line(s): ${removed.map(nameOf).join(', ')} — keeping ${kept.length}`
      )
      if (APPLY) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { ingredients: kept as object[] },
        })
      }
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Dry run'}: ${variantsChanged} variants, ${linesRemoved} duplicate lines removed.`)
  if (nearMisses.length) {
    console.log(`\nFor human review (${nearMisses.length}):`)
    console.log([...new Set(nearMisses)].join('\n'))
  }

  if (APPLY && variantsChanged) {
    console.log('\nRecalculating costs…')
    const report = await recalcAll('variant-dedupe')
    console.log(`Recalc: ${report.components.updated} components, ${report.variants.updated} variants updated, coverage ${(report.coveragePct * 100).toFixed(1)}%`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
