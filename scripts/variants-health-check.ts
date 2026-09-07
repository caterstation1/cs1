// Read-only health check for the Variants tab data (product_variants).
// Reports every inconsistency class the tab's editing model can produce.
// Usage: npx tsx scripts/variants-health-check.ts

import { prisma } from '../src/lib/prisma'

const splitParts = (title: string) =>
  (title || '').split(' / ').map((p) => p.trim()).filter(Boolean)

const asArr = <T,>(v: unknown): (T | null)[] | null =>
  Array.isArray(v) ? (v as (T | null)[]).map((x) => x ?? null) : null

async function main() {
  const variants = await prisma.productVariant.findMany({
    select: {
      variantId: true,
      shopifyName: true,
      shopifyTitle: true,
      meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
      meats: true, timers: true, options: true,
      serveware: true,
      isDraft: true,
      totalCost: true,
      ingredients: true,
    },
  })

  let noArrays = 0
  let mirrorMismatch = 0
  const mirrorSamples: string[] = []
  let overlongArrays = 0
  let deepMeatTimer = 0
  const deepSamples: string[] = []
  let servewareTitleMismatch = 0
  const servewareSamples: string[] = []
  let emptyTitle = 0
  let zeroCostWithIngredients = 0

  // Part-level conflict detection (what makes the tab show blank cells)
  const partValues = new Map<string, { meats: Set<string>; timers: Set<string>; options: Set<string> }>()

  for (const v of variants) {
    const parts = splitParts(v.shopifyName)
    if (!parts.length) emptyTitle++

    const meats = asArr<string>(v.meats)
    const timers = asArr<number>(v.timers)
    const options = asArr<string>(v.options)
    if (!meats && !timers && !options) noArrays++

    // Legacy scalars vs array mirror
    const norm = (x: unknown) => (x == null || x === '' ? null : String(x))
    if (meats || timers || options) {
      const bad =
        (meats && (norm(meats[0]) !== norm(v.meat1) || norm(meats[1]) !== norm(v.meat2))) ||
        (timers && (norm(timers[0]) !== norm(v.timer1) || norm(timers[1]) !== norm(v.timer2))) ||
        (options && (norm(options[0]) !== norm(v.option1) || norm(options[1]) !== norm(v.option2)))
      if (bad) {
        mirrorMismatch++
        if (mirrorSamples.length < 8)
          mirrorSamples.push(
            `${v.variantId} "${v.shopifyName}" meats=${JSON.stringify(v.meats)} meat1/2=${v.meat1}/${v.meat2} ` +
            `timers=${JSON.stringify(v.timers)} timer1/2=${v.timer1}/${v.timer2} options=${JSON.stringify(v.options)} option1/2=${v.option1}/${v.option2}`
          )
      }
    }

    // Arrays longer than the number of title parts
    const maxLen = Math.max(meats?.length ?? 0, timers?.length ?? 0, options?.length ?? 0)
    if (maxLen > parts.length && parts.length > 0) overlongArrays++

    // meats/timers at index >= 2 (the "Clean Option Indices" target)
    for (let i = 2; i < maxLen; i++) {
      if ((meats?.[i] != null && meats[i] !== '') || timers?.[i] != null) {
        deepMeatTimer++
        if (deepSamples.length < 8) deepSamples.push(`${v.variantId} "${v.shopifyName}" idx=${i} meat=${meats?.[i]} timer=${timers?.[i]}`)
        break
      }
    }

    // Serveware flag vs title
    const titleSaysYes = /yes serveware/i.test(v.shopifyName)
    const titleSaysNo = /no serveware/i.test(v.shopifyName)
    if ((titleSaysYes && !v.serveware) || (titleSaysNo && v.serveware)) {
      servewareTitleMismatch++
      if (servewareSamples.length < 8) servewareSamples.push(`${v.variantId} "${v.shopifyName}" serveware=${v.serveware}`)
    }

    if (Array.isArray(v.ingredients) && (v.ingredients as unknown[]).length > 0 && v.totalCost === 0) {
      zeroCostWithIngredients++
    }

    // Collect per-part values for conflict report
    parts.forEach((part, idx) => {
      if (!partValues.has(part)) partValues.set(part, { meats: new Set(), timers: new Set(), options: new Set() })
      const bucket = partValues.get(part)!
      const m = meats ? meats[idx] : idx === 0 ? v.meat1 : idx === 1 ? v.meat2 : null
      const t = timers ? timers[idx] : idx === 0 ? v.timer1 : idx === 1 ? v.timer2 : null
      const o = options ? options[idx] : idx === 0 ? v.option1 : idx === 1 ? v.option2 : null
      if (m != null && m !== '') bucket.meats.add(String(m))
      if (t != null) bucket.timers.add(String(t))
      if (o != null && o !== '') bucket.options.add(String(o))
    })
  }

  const conflicted = [...partValues.entries()]
    .filter(([, b]) => b.meats.size > 1 || b.timers.size > 1 || b.options.size > 1)
    .map(([part, b]) => ({
      part,
      meats: [...b.meats], timers: [...b.timers], options: [...b.options],
    }))

  console.log(`Total variants: ${variants.length}`)
  console.log(`Distinct parts: ${partValues.size}`)
  console.log('')
  console.log(`Variants with NO array fields (legacy scalars only): ${noArrays}`)
  console.log(`Variants where arrays disagree with legacy mirror:   ${mirrorMismatch}`)
  mirrorSamples.forEach((s) => console.log(`   ${s}`))
  console.log(`Variants with arrays longer than title parts:        ${overlongArrays}`)
  console.log(`Variants with meat/timer set at index >= 2:          ${deepMeatTimer}`)
  deepSamples.forEach((s) => console.log(`   ${s}`))
  console.log(`Variants where serveware flag contradicts title:     ${servewareTitleMismatch}`)
  servewareSamples.forEach((s) => console.log(`   ${s}`))
  console.log(`Variants with ingredients but totalCost = 0:         ${zeroCostWithIngredients}`)
  console.log(`Variants with empty title:                           ${emptyTitle}`)
  console.log('')
  console.log(`Parts with CONFLICTING values across variants: ${conflicted.length}`)
  conflicted.slice(0, 25).forEach((c) =>
    console.log(`   "${c.part}" meats=[${c.meats}] timers=[${c.timers}] options=[${c.options}]`)
  )
  if (conflicted.length > 25) console.log(`   … and ${conflicted.length - 25} more`)

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
