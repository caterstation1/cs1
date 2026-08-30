// What option-based costing changes, measured in isolation.
//
//   npx tsx scripts/costing-parity.ts
//
// Costs every variant twice against live prices — once from its stored rows
// alone, once with the CostingOption catalogue applied — so the difference is
// attributable to options and not to a supplier price having moved since the
// stored totalCost was written.

import { costVariant } from '../src/lib/pricing/cost'
import { buildCostIndex } from '../src/lib/pricing/resolve'

const money = (n: number) => `$${n.toFixed(2)}`

async function main() {
  console.log('Building both cost indexes…')
  const [before, after] = await Promise.all([
    buildCostIndex({ includeCostingOptions: false }),
    buildCostIndex({ includeCostingOptions: true }),
  ])

  const cacheBefore = new Map()
  const cacheAfter = new Map()

  let sumBefore = 0
  let sumAfter = 0
  let unchanged = 0
  let gained = 0
  let lost = 0
  let stillZero = 0
  const movers: Array<{ name: string; from: number; to: number }> = []

  for (const variant of after.variantsByVariantId.values()) {
    const a = costVariant(variant.variantId, before, { cache: cacheBefore })
    const b = costVariant(variant.variantId, after, { cache: cacheAfter })
    const from = a.total ?? 0
    const to = b.total ?? 0
    sumBefore += from
    sumAfter += to

    if (Math.abs(to - from) < 0.005) {
      if (to === 0) stillZero++
      else unchanged++
      continue
    }
    if (to > from) gained++
    else lost++
    movers.push({ name: variant.name, from, to })
  }

  movers.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from))

  const total = after.variantsByVariantId.size
  console.log()
  console.log(`Variants                  ${total}`)
  console.log(`  unchanged               ${unchanged}`)
  console.log(`  cost went up            ${gained}`)
  console.log(`  cost went down          ${lost}`)
  console.log(`  still costing nothing   ${stillZero}`)
  console.log()
  console.log(`Sum of variant cost  before ${money(sumBefore)}   after ${money(sumAfter)}   (${sumAfter >= sumBefore ? '+' : ''}${money(sumAfter - sumBefore)})`)

  if (lost > 0) {
    console.log()
    console.log('Variants that LOST cost — these need explaining before this ships:')
    for (const m of movers.filter((m) => m.to < m.from).slice(0, 20)) {
      console.log(`  ${money(m.from).padStart(10)} -> ${money(m.to).padStart(10)}   ${m.name}`)
    }
  }

  console.log()
  console.log('Biggest increases (gaps the options filled):')
  for (const m of movers.filter((m) => m.to > m.from).slice(0, 20)) {
    console.log(`  ${money(m.from).padStart(10)} -> ${money(m.to).padStart(10)}   ${m.name}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
