// Derives the CostingOption catalogue from the variant titles already in the
// shop, so option-based costing starts from what is actually being sold.
//
//   npx tsx scripts/seed-costing-options.ts            # report only
//   npx tsx scripts/seed-costing-options.ts --apply    # write
//
// Options are created with an empty recipe unless an existing ProductRule
// already says what the choice contributes. Nothing is guessed from component
// names here: those suggestions belong in the UI where a human confirms them.

import { PrismaClient } from '../src/generated/prisma'
import { normalizeOptionKey, normalizeRows, type RecipeRow } from '../src/lib/costing/options'
import { splitParts } from '../src/lib/variant-part-edit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Choices that genuinely cost nothing, so they stop reading as costing gaps. */
function isFreeOfCharge(name: string): boolean {
  const t = name.trim()
  if (/^no\b/i.test(t)) return true
  if (/^default title$/i.test(t)) return true
  // Gift card denominations and the headcount pickers on party packs.
  if (/^\$?[\d,]+(\.\d{2})?$/.test(t)) return true
  if (/^\d+\s*-\s*\d+(\s*ppl)?$/i.test(t)) return true
  if (/^(birthday|thank you|gift)\s*\d*$/i.test(t)) return true
  return false
}

function kindOf(name: string): string {
  if (/serveware/i.test(name)) return 'serveware'
  if (/^(yes|no)\b/i.test(name)) return 'addon'
  return 'choice'
}

async function main() {
  const [variants, rules, existing] = await Promise.all([
    prisma.productVariant.findMany({ select: { shopifyName: true } }),
    prisma.productRule.findMany({ select: { matchPattern: true, setIngredients: true } }),
    prisma.costingOption.findMany({ select: { name: true, aliases: { select: { value: true } } } }),
  ])

  // Group the spellings Shopify actually uses into one option each.
  const spellingCounts = new Map<string, number>()
  for (const v of variants) {
    for (const part of splitParts(v.shopifyName)) {
      spellingCounts.set(part, (spellingCounts.get(part) ?? 0) + 1)
    }
  }

  const groups = new Map<string, { spellings: Array<{ name: string; count: number }>; total: number }>()
  for (const [name, count] of spellingCounts) {
    const key = normalizeOptionKey(name) || name.toLowerCase()
    const group = groups.get(key) ?? { spellings: [], total: 0 }
    group.spellings.push({ name, count })
    group.total += count
    groups.set(key, group)
  }

  // Existing rules are already option-to-ingredient mappings; reuse them so
  // the choices that were costed correctly stay costed correctly.
  const ruleItems = new Map<string, RecipeRow[]>()
  for (const rule of rules) {
    const rows = normalizeRows(rule.setIngredients)
    if (rows.length === 0) continue
    const key = normalizeOptionKey(rule.matchPattern)
    if (!key) continue
    // Two Build a Bagel Box rules exist; merge rather than let one win.
    const merged = [...(ruleItems.get(key) ?? []), ...rows]
    ruleItems.set(key, merged)
  }

  const takenAliases = new Set(existing.flatMap((o) => o.aliases.map((a) => a.value)))
  const takenNames = new Set(existing.map((o) => o.name))

  let created = 0
  let skipped = 0
  let withRecipe = 0
  let freeOfCharge = 0
  const report: Array<{ name: string; variants: number; spellings: number; items: string; kind: string }> = []

  for (const [key, group] of Array.from(groups).sort((a, b) => b[1].total - a[1].total)) {
    group.spellings.sort((a, b) => b.count - a.count)
    const canonical = group.spellings[0].name
    if (takenNames.has(canonical) || group.spellings.every((s) => takenAliases.has(s.name))) {
      skipped++
      continue
    }

    const items = ruleItems.get(key) ?? []
    const free = isFreeOfCharge(canonical)
    if (items.length > 0) withRecipe++
    if (free) freeOfCharge++

    report.push({
      name: canonical,
      variants: group.total,
      spellings: group.spellings.length,
      items: free ? 'no ingredients' : items.map((i) => i.name).join(', ') || '—',
      kind: kindOf(canonical),
    })

    if (APPLY) {
      await prisma.costingOption.create({
        data: {
          name: canonical,
          kind: kindOf(canonical),
          items: items as any,
          noIngredients: free,
          aliases: {
            create: group.spellings
              .filter((s) => s.name !== canonical && !takenAliases.has(s.name))
              .map((s) => ({ value: s.name })),
          },
        },
      })
    }
    created++
  }

  console.log(`Variant title spellings: ${spellingCounts.size}`)
  console.log(`Distinct options:        ${groups.size}`)
  console.log(`Already present:         ${skipped}`)
  console.log(`${APPLY ? 'Created' : 'Would create'}: ${created}  (${withRecipe} with a recipe from an existing rule, ${freeOfCharge} marked as costing nothing)`)
  console.log()
  console.log('  variants  sp  kind       option                                 recipe')
  for (const r of report.slice(0, 45)) {
    console.log(
      `  ${String(r.variants).padStart(8)}  ${String(r.spellings).padStart(2)}  ${r.kind.padEnd(9)}  ${r.name.slice(0, 36).padEnd(36)}  ${r.items.slice(0, 60)}`
    )
  }
  if (report.length > 45) console.log(`  … and ${report.length - 45} more`)
  if (!APPLY) console.log('\nNothing written. Re-run with --apply.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
