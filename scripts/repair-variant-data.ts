// One-off repair for product_variants data drift found by
// scripts/variants-health-check.ts:
//
//  A. Junk array slots: meats/timers/options arrays with ""/null at index 0/1
//     while the legacy scalar (meat1/meat2 …) still holds the real value.
//     Runsheets and labels read the legacy scalars, but the save routes used
//     to mirror arrays[0]/[1] over them, so these rows were one save away
//     from losing kitchen data. Fix: seed the array slot from legacy.
//  B. Junk meat/timer at index >= 2 on option parts ("No Serveware") or
//     beyond the title's parts. Never touches index 0/1.
//  C. serveware flag contradicting an explicit "Yes/No Serveware" title.
//
// Usage:
//   npx tsx scripts/repair-variant-data.ts            (dry run, no writes)
//   npx tsx scripts/repair-variant-data.ts --apply    (write)

import { prisma } from '../src/lib/prisma'
import { isOptionPart, loadPartArrays, partArraysUpdateData } from '../src/lib/variant-part-edit'

const APPLY = process.argv.includes('--apply')

async function main() {
  const variants = await prisma.productVariant.findMany({
    select: {
      variantId: true,
      shopifyName: true,
      meats: true, timers: true, options: true,
      meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
      serveware: true,
    },
  })

  let seeded = 0
  let junkCleared = 0
  let servewareFixed = 0
  let written = 0
  const samples: string[] = []

  for (const v of variants) {
    const hadArrays = Array.isArray(v.meats) || Array.isArray(v.timers) || Array.isArray(v.options)
    const before = JSON.stringify([v.meats, v.timers, v.options])

    const arrays = loadPartArrays(v)

    // B: junk meat/timer at idx >= 2 (orphaned or option part)
    const maxLen = Math.max(arrays.meats.length, arrays.timers.length, arrays.options.length)
    let clearedHere = false
    for (let i = 2; i < maxLen; i++) {
      const orphaned = i >= arrays.parts.length
      const optionOnly = !orphaned && isOptionPart(arrays.parts[i])
      if (!orphaned && !optionOnly) continue
      if (arrays.meats[i] != null && arrays.meats[i] !== '') { arrays.meats[i] = null; clearedHere = true }
      if (arrays.timers[i] != null) { arrays.timers[i] = null; clearedHere = true }
      if (orphaned && arrays.options[i] != null && arrays.options[i] !== '') { arrays.options[i] = null; clearedHere = true }
    }

    const after = JSON.stringify([arrays.meats, arrays.timers, arrays.options])
    // Only variants that already had arrays need the array write: for
    // legacy-only rows the loaded arrays are a faithful copy of the scalars.
    const arraysChanged = hadArrays && before !== after
    const seededHere = arraysChanged && !clearedHere

    // C: serveware vs explicit title
    const saysYes = /yes serveware/i.test(v.shopifyName)
    const saysNo = /no serveware/i.test(v.shopifyName)
    const servewareWant = saysYes === saysNo ? null : saysYes
    const servewareChange = servewareWant != null && v.serveware !== servewareWant

    if (!arraysChanged && !servewareChange) continue

    if (seededHere) seeded++
    if (clearedHere) junkCleared++
    if (servewareChange) servewareFixed++

    if (samples.length < 15) {
      const what = [
        seededHere ? 'seed-arrays-from-legacy' : '',
        clearedHere ? 'clear-junk-idx>=2' : '',
        servewareChange ? `serveware→${servewareWant}` : '',
      ].filter(Boolean).join(', ')
      samples.push(`${v.variantId} "${v.shopifyName}" [${what}]`)
    }

    if (APPLY) {
      const data: Record<string, unknown> = arraysChanged ? partArraysUpdateData(arrays) : {}
      if (servewareChange) data.serveware = servewareWant
      await prisma.productVariant.update({ where: { variantId: v.variantId }, data })
      written++
    }
  }

  console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} over ${variants.length} variants`)
  console.log(`  arrays seeded from legacy scalars: ${seeded}`)
  console.log(`  junk meat/timer cleared (idx>=2):  ${junkCleared}`)
  console.log(`  serveware synced from title:       ${servewareFixed}`)
  if (APPLY) console.log(`  rows written:                      ${written}`)
  console.log('')
  samples.forEach((s) => console.log(`  ${s}`))

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
