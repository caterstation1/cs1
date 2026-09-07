// Dumps every recipe JSON column to a timestamped file before a backfill
// stamps ingredientId into it. Read-only; the file is the way back.
//
//   npx tsx scripts/snapshot-recipe-json.ts
//   npx tsx scripts/snapshot-recipe-json.ts --restore=.backups/recipe-json-<stamp>.json

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { Prisma } from '../src/generated/prisma'
import { prisma } from '../src/lib/prisma'

interface Snapshot {
  takenAt: string
  components: Array<{ id: string; ingredients: Prisma.JsonValue }>
  products: Array<{ id: string; baseIngredients: Prisma.JsonValue }>
  variants: Array<{ id: string; ingredients: Prisma.JsonValue }>
}

async function take() {
  const [components, products, variants] = await Promise.all([
    prisma.component.findMany({ select: { id: true, ingredients: true } }),
    prisma.shopifyProduct.findMany({ select: { id: true, baseIngredients: true } }),
    prisma.productVariant.findMany({ select: { id: true, ingredients: true } }),
  ])
  const snapshot: Snapshot = { takenAt: new Date().toISOString(), components, products, variants }
  mkdirSync('.backups', { recursive: true })
  const path = `.backups/recipe-json-${snapshot.takenAt.replace(/[:.]/g, '-')}.json`
  writeFileSync(path, JSON.stringify(snapshot, null, 2))
  console.log(`Snapshot written: ${path}`)
  console.log(`  components ${components.length}, products ${products.length}, variants ${variants.length}`)
  console.log(`\nRestore with:\n  npx tsx scripts/snapshot-recipe-json.ts --restore=${path}`)
}

async function restore(path: string) {
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as Snapshot
  console.log(`Restoring recipe JSON from ${path} (taken ${snapshot.takenAt})`)
  let n = 0
  for (const c of snapshot.components) {
    await prisma.component.update({ where: { id: c.id }, data: { ingredients: c.ingredients as Prisma.InputJsonValue } })
    n++
  }
  for (const p of snapshot.products) {
    await prisma.shopifyProduct.update({ where: { id: p.id }, data: { baseIngredients: p.baseIngredients as Prisma.InputJsonValue } })
    n++
  }
  for (const v of snapshot.variants) {
    await prisma.productVariant.update({ where: { id: v.id }, data: { ingredients: v.ingredients as Prisma.InputJsonValue } })
    n++
  }
  console.log(`Restored ${n} record(s).`)
}

const restorePath = process.argv.slice(2).find((a) => a.startsWith('--restore='))?.slice('--restore='.length)
;(restorePath ? restore(restorePath) : take())
  .catch((e) => { console.error('[snapshot] Fatal:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
