// Builds the Ingredient master out of data that already exists: the four
// supplier catalogues and the (source, id) refs frozen into every recipe JSON
// row. Nothing is typed in by hand, and nothing is merged automatically.
//
// Dry run by default. Read the report, then rerun with --apply.
//
// Usage:
//   npx tsx scripts/backfill-ingredient-master.ts               # dry run
//   npx tsx scripts/backfill-ingredient-master.ts --apply
//   npx tsx scripts/backfill-ingredient-master.ts --limit=25    # rows per table in the report
//
// Idempotent: an existing IngredientSupplierLink for a catalogue row means that
// row is already mastered, so a second run creates nothing. Reruns are safe
// even after a human has renamed or merged ingredients, because the link — not
// the name — is what identifies work already done.

import { Prisma } from '../src/generated/prisma'
import { prisma } from '../src/lib/prisma'
import { deriveUnitPricing, parsePackStructure } from '../src/lib/pricing/packsize'
import type { CanonicalUnit } from '../src/lib/pricing/units'

type Source = 'Gilmours' | 'Bidfood' | 'ProduceCo' | 'Other'

const SOURCES: Source[] = ['Gilmours', 'Bidfood', 'ProduceCo', 'Other']
const LOW_CONFIDENCE = 0.6

interface Options {
  apply: boolean
  limit: number
  similarity: number
}

function parseOptions(argv: string[]): Options {
  const flag = (n: string) => argv.includes(`--${n}`)
  const value = (n: string) => {
    const p = `--${n}=`
    const f = argv.find((a) => a.startsWith(p))
    return f ? f.slice(p.length) : null
  }
  return {
    apply: flag('apply'),
    limit: Number(value('limit') ?? 25),
    similarity: Number(value('similarity') ?? 0.86),
  }
}

/** A catalogue row, flattened so the four tables can be handled as one list. */
interface CatalogueRow {
  source: Source
  id: string
  code: string
  /** description / productName / name, as the supplier wrote it. */
  rawName: string
  price: number | null
  packSize: string | null
  uom: string | null
  ctnQty: string | null
  isPreferred: boolean
  /** Peter's curated common name. A hint for merge review, never a key. */
  preferredReference: string | null
  allergens: string[]
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
  updatedAt: Date
}

function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Strips pack sizes, brand noise and punctuation so 'SOUR CREAM 2KG @' and
// 'Sour Cream' collapse to the same token for suggestion purposes only.
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(kg|kgs|g|gm|gms|mg|l|lt|ltr|litre|liter|ml|cl|dl|ea|each|pk|pkt|pack|pc|pcs)\b/g, ' ')
    .replace(/\b\d+\s*[x×]\s*\d+(\.\d+)?\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|and|of|with|fresh|frozen|nz|imported)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = curr
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest
}

// preferredAllergens is free text curated per row; these are the only values
// present in the data today (dairy, egg, garlic, gluten, milk, onion, sesame, soy).
function allergenFlags(values: string[]) {
  const set = new Set(values.map((v) => v.trim().toLowerCase()))
  const has = (...keys: string[]) => keys.some((k) => set.has(k))
  return {
    hasGluten: has('gluten', 'wheat'),
    hasDairy: has('dairy', 'milk'),
    hasSoy: has('soy', 'soya'),
    hasOnionGarlic: has('onion', 'garlic'),
    hasSesame: has('sesame'),
    hasNuts: has('nuts', 'nut', 'peanut', 'peanuts', 'treenut', 'tree nuts'),
    hasEgg: has('egg', 'eggs'),
  }
}

async function loadCatalogue(): Promise<CatalogueRow[]> {
  const [gilmours, bidfood, produceCo, other] = await Promise.all([
    prisma.gilmoursProduct.findMany(),
    prisma.bidfoodProduct.findMany(),
    prisma.produceCoProduct.findMany(),
    prisma.otherProduct.findMany(),
  ])

  const rows: CatalogueRow[] = []
  for (const r of gilmours) {
    rows.push({
      source: 'Gilmours', id: r.id, code: r.sku, rawName: r.description || r.sku,
      price: r.price, packSize: r.packSize, uom: r.uom, ctnQty: null,
      isPreferred: r.isPreferred, preferredReference: r.preferredReference,
      allergens: r.preferredAllergens, isVegetarian: false, isVegan: false, isHalal: false,
      updatedAt: r.updatedAt,
    })
  }
  for (const r of bidfood) {
    rows.push({
      source: 'Bidfood', id: r.id, code: r.productCode, rawName: r.description || r.productCode,
      price: r.lastPricePaid, packSize: r.packSize, uom: r.uom, ctnQty: r.ctnQty,
      isPreferred: r.isPreferred, preferredReference: r.preferredReference,
      allergens: r.preferredAllergens, isVegetarian: false, isVegan: false, isHalal: false,
      updatedAt: r.updatedAt,
    })
  }
  for (const r of produceCo) {
    rows.push({
      source: 'ProduceCo', id: r.id, code: r.productCode, rawName: r.productName || r.productCode,
      price: r.price, packSize: null, uom: null, ctnQty: null,
      isPreferred: r.isPreferred, preferredReference: r.preferredReference,
      allergens: r.preferredAllergens, isVegetarian: false, isVegan: false, isHalal: false,
      updatedAt: r.updatedAt,
    })
  }
  for (const r of other) {
    rows.push({
      source: 'Other', id: r.id, code: r.name, rawName: r.name,
      price: r.cost, packSize: null, uom: null, ctnQty: null,
      isPreferred: r.isPreferred, preferredReference: r.preferredReference,
      allergens: r.preferredAllergens, isVegetarian: r.isVegetarian, isVegan: r.isVegan, isHalal: r.isHalal,
      updatedAt: r.updatedAt,
    })
  }
  return rows
}

/** Every place a recipe JSON array lives, so refs can be harvested and stamped. */
interface JsonHolder {
  table: 'Component' | 'ShopifyProduct' | 'ProductVariant'
  id: string
  field: 'ingredients' | 'baseIngredients'
  rows: RecipeJsonRow[]
}

/**
 * A recipe JSON row as Prisma will accept it back. Typed as an input value
 * rather than `Record<string, unknown>` so a stamped array can be written
 * straight back to the Json column without a cast.
 */
type RecipeJsonRow = Prisma.JsonObject

async function loadJsonHolders(): Promise<JsonHolder[]> {
  const [components, products, variants] = await Promise.all([
    prisma.component.findMany({ select: { id: true, ingredients: true } }),
    prisma.shopifyProduct.findMany({ select: { id: true, baseIngredients: true } }),
    prisma.productVariant.findMany({ select: { id: true, ingredients: true } }),
  ])
  // The only assertion in the script: a JSON array element that is a non-null
  // object is a JSON object. Everything else is filtered out.
  const asRows = (v: unknown): RecipeJsonRow[] =>
    Array.isArray(v) ? (v.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as RecipeJsonRow[]) : []

  return [
    ...components.map((c): JsonHolder => ({ table: 'Component', id: c.id, field: 'ingredients', rows: asRows(c.ingredients) })),
    ...products.map((p): JsonHolder => ({ table: 'ShopifyProduct', id: p.id, field: 'baseIngredients', rows: asRows(p.baseIngredients) })),
    ...variants.map((v): JsonHolder => ({ table: 'ProductVariant', id: v.id, field: 'ingredients', rows: asRows(v.ingredients) })),
  ]
}

interface PlannedIngredient {
  key: string
  row: CatalogueRow
  name: string
  nameSuffixed: boolean
  canonicalUnit: CanonicalUnit
  flags: ReturnType<typeof allergenFlags>
  unitsPerPack: number
  sizePerUnit: number
  sizeUnit: string
  packConfidence: number
  packNotes: string[]
  /** Null when the catalogue price is unusable — no PricePoint is invented. */
  pricePoint: { packPrice: number; unitCost: number } | null
  priceProblem: string | null
  referenced: boolean
  existingIngredientId: string | null
}

interface MergeSuggestion {
  keys: string[]
  reason: string
  score: number
  label: string
}

const money = (v: number | null | undefined, dp = 2) =>
  v == null ? '—' : v.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp })

function truncate(v: string, w: number) {
  return v.length <= w ? v : `${v.slice(0, w - 1)}…`
}

function table(headers: string[], rows: string[][], align: Array<'l' | 'r'>) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const pad = (t: string, i: number) => (align[i] === 'r' ? t.padStart(widths[i]) : t.padEnd(widths[i]))
  return [
    headers.map(pad).join('  '),
    widths.map((w) => '-'.repeat(w)).join('  '),
    ...rows.map((r) => r.map((c, i) => pad(c ?? '', i)).join('  ')),
  ].join('\n')
}

function section(title: string) {
  console.log(`\n${title}`)
  console.log('='.repeat(title.length))
}

async function run() {
  const options = parseOptions(process.argv.slice(2))
  const mode = options.apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'

  section('Ingredient master backfill')
  console.log(`Mode:      ${mode}`)
  console.log(`Generated: ${new Date().toISOString()}`)

  const [catalogue, holders, existingLinks, existingIngredients] = await Promise.all([
    loadCatalogue(),
    loadJsonHolders(),
    prisma.ingredientSupplierLink.findMany({ select: { id: true, source: true, sourceId: true, ingredientId: true } }),
    prisma.ingredient.findMany({ select: { id: true, name: true } }),
  ])

  const catalogueByKey = new Map<string, CatalogueRow>()
  for (const row of catalogue) catalogueByKey.set(`${row.source}:${row.id}`, row)

  const linkByKey = new Map<string, { id: string; ingredientId: string }>()
  for (const l of existingLinks) linkByKey.set(`${l.source}:${l.sourceId}`, { id: l.id, ingredientId: l.ingredientId })

  const takenNames = new Set(existingIngredients.map((i) => i.name))

  // --- 1 & 2: harvest refs from recipes, plus every curated isPreferred row ---
  const referenced = new Set<string>()
  const brokenRefs = new Map<string, { source: string; id: string; name: string; holders: string[] }>()

  for (const holder of holders) {
    for (const r of holder.rows) {
      const source = String(r.source ?? '').trim()
      if (!SOURCES.includes(source as Source)) continue // Components/Products are nesting, not ingredients
      const id = String(r.id ?? '').trim()
      if (!id) continue
      const key = `${source}:${id}`
      if (catalogueByKey.has(key)) {
        referenced.add(key)
      } else {
        const entry = brokenRefs.get(key) ?? { source, id, name: String(r.name ?? ''), holders: [] }
        entry.holders.push(`${holder.table}:${holder.id}`)
        brokenRefs.set(key, entry)
      }
    }
  }

  const preferredKeys = catalogue.filter((r) => r.isPreferred).map((r) => `${r.source}:${r.id}`)
  const harvested = new Set<string>([...referenced, ...preferredKeys])

  // --- 3: plan one Ingredient per catalogue row ---
  //
  // One per row, never grouped. Grouping by name or by preferredReference would
  // be an automatic merge, which ground rule 6 forbids — and the data proves why:
  // one preferredReference group pairs 'Chicken Liver' with 'Rice Vinegar'.
  // Candidates are emitted as IngredientMergeSuggestion for a human instead.
  const planned: PlannedIngredient[] = []
  const nameCounts = new Map<string, number>()
  for (const key of harvested) {
    const row = catalogueByKey.get(key)
    if (!row) continue
    const base = titleCase(row.rawName) || `${row.source} ${row.code}`
    nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1)
  }

  for (const key of [...harvested].sort()) {
    const row = catalogueByKey.get(key)
    if (!row) continue

    const structure = parsePackStructure(row.packSize, row.uom, row.ctnQty)
    const derived =
      row.price != null && Number.isFinite(row.price) && row.price > 0
        ? deriveUnitPricing({ packSize: row.packSize, uom: row.uom, ctnQty: row.ctnQty, price: row.price })
        : null

    let priceProblem: string | null = null
    if (row.price == null || !Number.isFinite(row.price)) priceProblem = 'no price'
    else if (row.price < 0) priceProblem = 'negative price'
    else if (row.price === 0) priceProblem = 'price is $0 (unknown, not free)'
    else if (!derived) priceProblem = 'pack size unreadable'

    const base = titleCase(row.rawName) || `${row.source} ${row.code}`
    const collides = (nameCounts.get(base) ?? 0) > 1 || takenNames.has(base)
    // OtherProduct has no code of its own — its "code" is its name — and the
    // table allows duplicate names, so a code suffix would not disambiguate.
    // Fall back to the row id, which always does.
    const codeToken = String(row.code).trim()
    const discriminator =
      codeToken && normalizeForMatch(codeToken) !== normalizeForMatch(row.rawName) ? codeToken : row.id.slice(0, 8)
    let name = collides ? `${base} (${row.source} ${discriminator})` : base
    let attempt = 2
    while (takenNames.has(name)) name = `${base} (${row.source} ${discriminator} #${attempt++})`
    takenNames.add(name)

    planned.push({
      key,
      row,
      name,
      nameSuffixed: collides,
      canonicalUnit: derived?.unit ?? structure.canonicalUnit,
      flags: allergenFlags(row.allergens),
      unitsPerPack: structure.unitsPerPack,
      sizePerUnit: structure.sizePerUnit,
      sizeUnit: structure.sizeUnit,
      packConfidence: structure.confidence,
      packNotes: structure.notes,
      pricePoint: derived ? { packPrice: row.price as number, unitCost: derived.unitCost } : null,
      priceProblem,
      referenced: referenced.has(key),
      existingIngredientId: linkByKey.get(key)?.ingredientId ?? null,
    })
  }

  const toCreate = planned.filter((p) => !p.existingIngredientId)
  const alreadyMastered = planned.filter((p) => p.existingIngredientId)

  // --- 4: merge suggestions (suggest only, never act) ---
  const suggestions: MergeSuggestion[] = []

  const byNormalized = new Map<string, PlannedIngredient[]>()
  for (const p of planned) {
    const n = normalizeForMatch(p.row.rawName)
    if (!n) continue
    const b = byNormalized.get(n) ?? []
    b.push(p)
    byNormalized.set(n, b)
  }
  for (const [norm, group] of byNormalized) {
    if (group.length < 2) continue
    // Same supplier, same name is a different problem from two suppliers
    // selling the same thing: it is usually a duplicate row, not a pairing.
    // Both need a human, but they need different actions.
    const singleSupplier = new Set(group.map((g) => g.row.source)).size === 1
    suggestions.push({
      keys: group.map((g) => g.key),
      reason: singleSupplier ? 'duplicate-row' : 'normalized-name',
      score: 1,
      label: `${norm} — ${group.map((g) => `${g.row.source} ${g.row.code}`).join(', ')}`,
    })
  }

  // Peter's own curation, surfaced for review rather than trusted as a key.
  const byPreferredRef = new Map<string, PlannedIngredient[]>()
  for (const p of planned) {
    const ref = p.row.preferredReference?.trim().toLowerCase()
    if (!ref) continue
    const b = byPreferredRef.get(ref) ?? []
    b.push(p)
    byPreferredRef.set(ref, b)
  }
  for (const [ref, group] of byPreferredRef) {
    if (group.length < 2) continue
    if (suggestions.some((s) => s.keys.length === group.length && group.every((g) => s.keys.includes(g.key)))) continue
    suggestions.push({
      keys: group.map((g) => g.key),
      reason: 'preferred-reference',
      score: 0.9,
      label: `"${ref}" — ${group.map((g) => `${g.row.source} ${truncate(g.row.rawName, 24)}`).join(' | ')}`,
    })
  }

  const normalizedList = [...byNormalized.entries()].filter(([n]) => n.length > 3)
  for (let i = 0; i < normalizedList.length; i++) {
    for (let j = i + 1; j < normalizedList.length; j++) {
      const [na, ga] = normalizedList[i]
      const [nb, gb] = normalizedList[j]
      const sources = new Set([...ga, ...gb].map((g) => g.row.source))
      if (sources.size < 2) continue // cross-supplier candidates are the useful ones
      const score = similarity(na, nb)
      if (score < options.similarity) continue
      suggestions.push({
        keys: [...ga, ...gb].map((g) => g.key),
        reason: 'similarity',
        score: Number(score.toFixed(3)),
        label: `${na} ≈ ${nb} (${(score * 100).toFixed(1)}%)`,
      })
    }
  }

  // --- 7: which recipe rows would gain an ingredientId ---
  let stampable = 0
  let alreadyStamped = 0
  const plannedKeys = new Set(planned.map((p) => p.key))
  for (const holder of holders) {
    for (const r of holder.rows) {
      const source = String(r.source ?? '').trim()
      if (!SOURCES.includes(source as Source)) continue
      const key = `${source}:${String(r.id ?? '').trim()}`
      if (!plannedKeys.has(key)) continue
      if (r.ingredientId) alreadyStamped += 1
      else stampable += 1
    }
  }

  // ------------------------------- report -------------------------------
  section('What was harvested')
  console.log(
    table(
      ['', 'Count'],
      [
        ['Catalogue rows (all four tables)', String(catalogue.length)],
        ['Referenced by a recipe row', String(referenced.size)],
        ['Curated isPreferred (kept even if unreferenced)', String(new Set(preferredKeys).size)],
        ['Harvested (union)', String(harvested.size)],
        ['Already mastered by an existing link', String(alreadyMastered.length)],
        ['Ingredients + links to create', String(toCreate.length)],
        ['Broken refs (catalogue row gone)', String(brokenRefs.size)],
      ],
      ['l', 'r']
    )
  )

  const bySource = SOURCES.map((s) => {
    const rows = planned.filter((p) => p.row.source === s)
    return [
      s,
      String(rows.length),
      String(rows.filter((p) => p.referenced).length),
      String(rows.filter((p) => p.row.isPreferred).length),
      String(rows.filter((p) => p.pricePoint).length),
      String(rows.filter((p) => p.packConfidence < LOW_CONFIDENCE).length),
    ]
  })
  console.log()
  console.log(
    table(
      ['Source', 'Ingredients', 'Referenced', 'Preferred', 'Price points', 'Low-confidence packs'],
      bySource,
      ['l', 'r', 'r', 'r', 'r', 'r']
    )
  )

  section('Canonical units')
  const unitCounts = new Map<string, number>()
  for (const p of planned) unitCounts.set(p.canonicalUnit, (unitCounts.get(p.canonicalUnit) ?? 0) + 1)
  console.log(
    table(
      ['Unit', 'Ingredients'],
      [...unitCounts.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => [u, String(n)]),
      ['l', 'r']
    )
  )

  const noPrice = planned.filter((p) => !p.pricePoint)
  if (noPrice.length) {
    section(`No price point — catalogue price unusable (${noPrice.length})`)
    console.log('These get an Ingredient and a link, but no seeded price. Nothing is invented.\n')
    console.log(
      table(
        ['Source', 'Code', 'Ingredient', 'Price', 'Why'],
        noPrice.slice(0, options.limit).map((p) => [
          p.row.source, truncate(String(p.row.code), 14), truncate(p.name, 34),
          p.row.price == null ? '—' : money(p.row.price), p.priceProblem ?? '',
        ]),
        ['l', 'l', 'l', 'r', 'l']
      )
    )
    if (noPrice.length > options.limit) console.log(`… ${noPrice.length - options.limit} more`)
  }

  const lowConfidence = planned.filter((p) => p.packConfidence < LOW_CONFIDENCE)
  if (lowConfidence.length) {
    section(`Pack readings needing verification (${lowConfidence.length})`)
    console.log('packVerified=false on all new links; these are the ones to check first.\n')
    console.log(
      table(
        ['Source', 'Code', 'Ingredient', 'Read as', 'Conf', 'Why'],
        lowConfidence
          .sort((a, b) => a.packConfidence - b.packConfidence)
          .slice(0, options.limit)
          .map((p) => [
            p.row.source, truncate(String(p.row.code), 12), truncate(p.name, 30),
            `${p.unitsPerPack} x ${p.sizePerUnit}${p.sizeUnit}`,
            p.packConfidence.toFixed(2), truncate(p.packNotes.join('; '), 46),
          ]),
        ['l', 'l', 'l', 'l', 'r', 'l']
      )
    )
    if (lowConfidence.length > options.limit) console.log(`… ${lowConfidence.length - options.limit} more`)
  }

  const suffixed = planned.filter((p) => p.nameSuffixed)
  if (suffixed.length) {
    section(`Name collisions, disambiguated by suffix (${suffixed.length})`)
    console.log('Not merged — each keeps its own Ingredient and appears in the suggestions below.\n')
    console.log(
      table(
        ['Ingredient', 'Source', 'Code'],
        suffixed.slice(0, options.limit).map((p) => [truncate(p.name, 52), p.row.source, truncate(String(p.row.code), 14)]),
        ['l', 'l', 'l']
      )
    )
    if (suffixed.length > options.limit) console.log(`… ${suffixed.length - options.limit} more`)
  }

  if (suggestions.length) {
    section(`Merge suggestions (${suggestions.length}) — suggest only, nothing is merged`)
    const byReason = new Map<string, number>()
    for (const s of suggestions) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1)
    console.log(table(['Reason', 'Groups'], [...byReason.entries()].map(([r, n]) => [r, String(n)]), ['l', 'r']))
    console.log()
    console.log(
      table(
        ['Reason', 'Score', 'Candidates'],
        suggestions
          .sort((a, b) => b.score - a.score)
          .slice(0, options.limit)
          .map((s) => [s.reason, s.score.toFixed(2), truncate(s.label, 86)]),
        ['l', 'r', 'l']
      )
    )
    if (suggestions.length > options.limit) console.log(`… ${suggestions.length - options.limit} more`)
  }

  const duplicateGroups = suggestions.filter((s) => s.reason === 'duplicate-row')
  if (duplicateGroups.length) {
    section(`Possible duplicate catalogue rows (${duplicateGroups.length})`)
    console.log(
      'Same supplier, same name, different row. Either two real pack sizes or a duplicated row —\nworth fixing in the supplier tab rather than carrying two ingredients forever.\n'
    )
    const rows: string[][] = []
    for (const s of duplicateGroups.slice(0, options.limit)) {
      for (const key of s.keys) {
        const p = planned.find((x) => x.key === key)
        if (!p) continue
        rows.push([
          p.row.source,
          truncate(String(p.row.code), 14),
          truncate(p.row.rawName, 30),
          truncate(p.row.packSize ?? '—', 12),
          money(p.row.price),
          p.pricePoint ? `${money(p.pricePoint.unitCost, 4)}/${p.canonicalUnit}` : '—',
        ])
      }
      rows.push(['', '', '', '', '', ''])
    }
    console.log(table(['Source', 'Code', 'Name', 'Pack', 'Price', 'Unit cost'], rows, ['l', 'l', 'l', 'l', 'r', 'r']))
  }

  if (brokenRefs.size) {
    section(`Broken references (${brokenRefs.size})`)
    console.log('Recipe rows pointing at a catalogue row that no longer exists. Reported, never invented.\n')
    console.log(
      table(
        ['Source', 'Id', 'Name on the row', 'Used by'],
        [...brokenRefs.values()].slice(0, options.limit).map((b) => [
          b.source, truncate(b.id, 24), truncate(b.name, 30), String(b.holders.length),
        ]),
        ['l', 'l', 'l', 'r']
      )
    )
  }

  section('Recipe rows to stamp with ingredientId')
  console.log(
    table(
      ['', 'Rows'],
      [
        ['Would gain an ingredientId', String(stampable)],
        ['Already stamped', String(alreadyStamped)],
      ],
      ['l', 'r']
    )
  )

  section('Ranks')
  console.log(
    `Every new link is rank 1: one Ingredient per catalogue row means nothing to rank against yet.\npreferredReference never spans suppliers in this data, so it cannot seed a cross-supplier pairing.\nRanks become meaningful once the merge suggestions above are reviewed and acted on.`
  )

  if (!options.apply) {
    section('Next step')
    console.log('Dry run — nothing was written. Rerun with --apply to create the rows above.')
    return
  }

  // -------------------------------- apply --------------------------------
  section('Applying')
  let ingredientsCreated = 0
  let linksCreated = 0
  let pricePointsCreated = 0
  const ingredientIdByKey = new Map<string, string>()
  for (const p of alreadyMastered) ingredientIdByKey.set(p.key, p.existingIngredientId as string)

  for (const p of toCreate) {
    const created = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({
        data: {
          name: p.name,
          canonicalUnit: p.canonicalUnit,
          ...p.flags,
          isVegetarian: p.row.isVegetarian,
          isVegan: p.row.isVegan,
          isHalal: p.row.isHalal,
          notes: p.row.preferredReference ? `preferredReference: ${p.row.preferredReference}` : null,
        },
      })
      const link = await tx.ingredientSupplierLink.create({
        data: {
          ingredientId: ingredient.id,
          source: p.row.source,
          sourceId: p.row.id,
          rank: 1,
          unitsPerPack: p.unitsPerPack,
          sizePerUnit: p.sizePerUnit,
          sizeUnit: p.sizeUnit,
          packVerified: false,
          packConfidence: p.packConfidence,
          active: true,
        },
      })
      let seeded = false
      if (p.pricePoint) {
        await tx.pricePoint.create({
          data: {
            linkId: link.id,
            packPrice: p.pricePoint.packPrice,
            unitCost: p.pricePoint.unitCost,
            source: 'backfill',
            effectiveAt: p.row.updatedAt,
          },
        })
        seeded = true
      }
      return { ingredientId: ingredient.id, seeded }
    })
    ingredientIdByKey.set(p.key, created.ingredientId)
    ingredientsCreated += 1
    linksCreated += 1
    if (created.seeded) pricePointsCreated += 1
  }
  console.log(`Ingredients ${ingredientsCreated}, links ${linksCreated}, price points ${pricePointsCreated}`)

  // Seed price history for links that already existed but have none.
  let backfilledPricePoints = 0
  for (const p of alreadyMastered) {
    if (!p.pricePoint) continue
    const link = linkByKey.get(p.key)
    if (!link) continue
    const existing = await prisma.pricePoint.findFirst({ where: { linkId: link.id, source: 'backfill' } })
    if (existing) continue
    await prisma.pricePoint.create({
      data: {
        linkId: link.id,
        packPrice: p.pricePoint.packPrice,
        unitCost: p.pricePoint.unitCost,
        source: 'backfill',
        effectiveAt: p.row.updatedAt,
      },
    })
    backfilledPricePoints += 1
  }
  if (backfilledPricePoints) console.log(`Seeded ${backfilledPricePoints} price point(s) on pre-existing links`)

  // --- 7: stamp ingredientId into the JSON rows (add the key, change nothing else) ---
  let stamped = 0
  let holdersUpdated = 0
  for (const holder of holders) {
    let changed = false
    const next = holder.rows.map((r) => {
      const source = String(r.source ?? '').trim()
      if (!SOURCES.includes(source as Source)) return r
      const key = `${source}:${String(r.id ?? '').trim()}`
      const ingredientId = ingredientIdByKey.get(key)
      if (!ingredientId || r.ingredientId === ingredientId) return r
      changed = true
      stamped += 1
      return { ...r, ingredientId }
    })
    if (!changed) continue
    if (holder.table === 'Component') {
      await prisma.component.update({ where: { id: holder.id }, data: { ingredients: next } })
    } else if (holder.table === 'ShopifyProduct') {
      await prisma.shopifyProduct.update({ where: { id: holder.id }, data: { baseIngredients: next } })
    } else {
      await prisma.productVariant.update({ where: { id: holder.id }, data: { ingredients: next } })
    }
    holdersUpdated += 1
  }
  console.log(`Stamped ${stamped} recipe row(s) across ${holdersUpdated} record(s)`)

  // --- 4: persist merge suggestions, deduped against what is already open ---
  let suggestionsCreated = 0
  const openSuggestions = await prisma.ingredientMergeSuggestion.findMany({
    where: { status: 'open' },
    select: { ingredientIds: true },
  })
  const seen = new Set(openSuggestions.map((s) => [...s.ingredientIds].sort().join('|')))
  for (const s of suggestions) {
    const ids = [...new Set(s.keys.map((k) => ingredientIdByKey.get(k)).filter(Boolean) as string[])].sort()
    if (ids.length < 2) continue
    const fingerprint = ids.join('|')
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    await prisma.ingredientMergeSuggestion.create({
      data: { ingredientIds: ids, reason: s.reason, score: s.score, status: 'open' },
    })
    suggestionsCreated += 1
  }
  console.log(`Merge suggestions recorded: ${suggestionsCreated}`)

  // --- 8: broken refs raise an alert rather than inventing a price ---
  let alertsCreated = 0
  for (const b of brokenRefs.values()) {
    const refId = `${b.source}:${b.id}`
    const existing = await prisma.priceAlert.findFirst({
      where: { type: 'broken_ref', refId, status: 'open' },
    })
    if (existing) continue
    await prisma.priceAlert.create({
      data: {
        type: 'broken_ref',
        refType: 'ingredient',
        refId,
        message: `Recipe rows reference ${b.source} row ${b.id} ("${b.name}"), which no longer exists.`,
        data: { holders: b.holders },
        status: 'open',
      },
    })
    alertsCreated += 1
  }
  if (alertsCreated) console.log(`Broken-ref alerts raised: ${alertsCreated}`)

  section('Done')
  console.log('Rerunning this script now should report 0 ingredients and 0 links to create.')
}

run()
  .catch((error) => {
    console.error('[ingredient-master] Fatal error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
