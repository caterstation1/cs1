// Unified ingredient search across the master list, all four supplier
// catalogues, and components.
//
// This was a dead Firestore-era stub returning []. Because it returned nothing,
// IngredientSelector fetched all five catalogues in full on every debounced
// keystroke and filtered them in the browser. One indexed query replaces that.
//
// Every row comes back with a derived unit cost *and* the confidence of the
// pack reading behind it, so the caller can show when a price is a guess
// instead of silently treating it as fact.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deriveUnitPricing, unitNamesPackFor } from '@/lib/pricing/packsize'

export type SearchSource = 'Gilmours' | 'Bidfood' | 'ProduceCo' | 'Other' | 'Components' | 'Master'

export interface IngredientSearchResult {
  source: SearchSource
  id: string
  code: string | null
  name: string
  /** Present when the row is linked to the Ingredient master. */
  ingredientId: string | null
  packSize: string | null
  uom: string | null
  /** Price as the supplier states it, before any pack interpretation. */
  packPrice: number | null
  /** Price per canonical unit, or null when it cannot be derived. */
  unitCost: number | null
  unit: string | null
  /** 0-1. Below ~0.6 the pack reading is a guess worth checking. */
  confidence: number | null
  isPreferred: boolean
  /** Why unitCost is null. */
  reason: string | null
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim()
    const source = (searchParams.get('source') || 'All') as SearchSource | 'All'
    const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

    // Two characters is the point where a prefix search stops returning
    // effectively the whole catalogue.
    if (query.length < 2) return NextResponse.json([])

    const want = (s: SearchSource) => source === 'All' || source === s
    const contains = { contains: query, mode: 'insensitive' as const }
    const perSource = limit

    const [gilmours, bidfood, produceCo, other, components, master] = await Promise.all([
      want('Gilmours')
        ? prisma.gilmoursProduct.findMany({
            where: { OR: [{ description: contains }, { sku: contains }, { brand: contains }] },
            take: perSource,
            orderBy: [{ isPreferred: 'desc' }, { description: 'asc' }],
          })
        : [],
      want('Bidfood')
        ? prisma.bidfoodProduct.findMany({
            where: { OR: [{ description: contains }, { productCode: contains }, { brand: contains }] },
            take: perSource,
            orderBy: [{ isPreferred: 'desc' }, { description: 'asc' }],
          })
        : [],
      want('ProduceCo')
        ? prisma.produceCoProduct.findMany({
            where: { OR: [{ productName: contains }, { productCode: contains }] },
            take: perSource,
            orderBy: [{ isPreferred: 'desc' }, { productName: 'asc' }],
          })
        : [],
      want('Other')
        ? prisma.otherProduct.findMany({
            where: { OR: [{ name: contains }, { supplier: contains }, { description: contains }] },
            take: perSource,
            orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
          })
        : [],
      want('Components')
        ? prisma.component.findMany({
            where: { name: contains },
            take: perSource,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, costPerOutputUnit: true, normalizedOutputUnit: true, totalCost: true },
          })
        : [],
      want('Master')
        ? prisma.ingredient.findMany({
            where: { name: contains, status: 'active' },
            take: perSource,
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              canonicalUnit: true,
              links: {
                where: { active: true },
                orderBy: { rank: 'asc' },
                take: 1,
                select: {
                  source: true,
                  sourceId: true,
                  packConfidence: true,
                  pricePoints: { orderBy: { effectiveAt: 'desc' }, take: 1, select: { unitCost: true, packPrice: true } },
                },
              },
            },
          })
        : [],
    ])

    // Which catalogue rows are already mastered, so a pick can carry its
    // ingredientId straight into the recipe row.
    const catalogueKeys: Array<{ source: string; sourceId: string }> = [
      ...gilmours.map((r) => ({ source: 'Gilmours', sourceId: r.id })),
      ...bidfood.map((r) => ({ source: 'Bidfood', sourceId: r.id })),
      ...produceCo.map((r) => ({ source: 'ProduceCo', sourceId: r.id })),
      ...other.map((r) => ({ source: 'Other', sourceId: r.id })),
    ]
    const links = catalogueKeys.length
      ? await prisma.ingredientSupplierLink.findMany({
          where: { OR: catalogueKeys, active: true },
          select: { source: true, sourceId: true, ingredientId: true },
        })
      : []
    const ingredientIdFor = new Map(links.map((l) => [`${l.source}:${l.sourceId}`, l.ingredientId]))

    const results: IngredientSearchResult[] = []

    const pushCatalogue = (
      src: 'Gilmours' | 'Bidfood' | 'ProduceCo' | 'Other',
      row: {
        id: string
        code: string | null
        name: string
        price: number | null
        packSize: string | null
        uom: string | null
        ctnQty: string | null
        isPreferred: boolean
      }
    ) => {
      const usablePrice = row.price != null && Number.isFinite(row.price) && row.price > 0
      const derived = usablePrice
        ? deriveUnitPricing({
            packSize: row.packSize,
            uom: row.uom,
            ctnQty: row.ctnQty,
            price: row.price,
            unitNamesPack: unitNamesPackFor(src),
          })
        : null
      results.push({
        source: src,
        id: row.id,
        code: row.code,
        name: row.name,
        ingredientId: ingredientIdFor.get(`${src}:${row.id}`) ?? null,
        packSize: row.packSize,
        uom: row.uom,
        packPrice: row.price,
        unitCost: derived?.unitCost ?? null,
        unit: derived?.unit ?? null,
        confidence: derived?.confidence ?? null,
        isPreferred: row.isPreferred,
        reason: derived ? null : usablePrice ? 'pack size unreadable' : 'no usable price',
      })
    }

    for (const r of gilmours) {
      pushCatalogue('Gilmours', {
        id: r.id, code: r.sku, name: r.description || r.sku, price: r.price,
        packSize: r.packSize, uom: r.uom, ctnQty: null, isPreferred: r.isPreferred,
      })
    }
    for (const r of bidfood) {
      pushCatalogue('Bidfood', {
        id: r.id, code: r.productCode, name: r.description || r.productCode, price: r.lastPricePaid,
        packSize: r.packSize, uom: r.uom, ctnQty: r.ctnQty, isPreferred: r.isPreferred,
      })
    }
    for (const r of produceCo) {
      pushCatalogue('ProduceCo', {
        id: r.id, code: r.productCode, name: r.productName || r.productCode, price: r.price,
        packSize: null, uom: null, ctnQty: null, isPreferred: r.isPreferred,
      })
    }
    for (const r of other) {
      pushCatalogue('Other', {
        id: r.id, code: null, name: r.name, price: r.cost,
        packSize: null, uom: null, ctnQty: null, isPreferred: r.isPreferred,
      })
    }

    for (const c of components) {
      results.push({
        source: 'Components',
        id: c.id,
        code: null,
        name: c.name,
        ingredientId: null,
        packSize: null,
        uom: null,
        packPrice: c.totalCost,
        unitCost: c.costPerOutputUnit > 0 ? c.costPerOutputUnit : null,
        unit: c.normalizedOutputUnit,
        confidence: 1,
        isPreferred: false,
        reason: c.costPerOutputUnit > 0 ? null : 'component has no cost per unit yet',
      })
    }

    for (const ing of master) {
      const link = ing.links[0]
      const point = link?.pricePoints[0]
      results.push({
        source: 'Master',
        id: ing.id,
        code: link?.sourceId ?? null,
        name: ing.name,
        ingredientId: ing.id,
        packSize: null,
        uom: null,
        packPrice: point?.packPrice ?? null,
        unitCost: point?.unitCost ?? null,
        unit: ing.canonicalUnit,
        confidence: link?.packConfidence ?? null,
        isPreferred: true,
        reason: point ? null : 'no price history for the preferred supplier',
      })
    }

    // Exact and prefix matches first, then priced before unpriced — an
    // unpriceable row is the least useful thing to offer.
    const needle = query.toLowerCase()
    const rank = (r: IngredientSearchResult) => {
      const name = r.name.toLowerCase()
      if (name === needle) return 0
      if (name.startsWith(needle)) return 1
      return 2
    }
    results.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.isPreferred) - Number(a.isPreferred) ||
        Number(b.unitCost != null) - Number(a.unitCost != null) ||
        a.name.localeCompare(b.name)
    )

    return NextResponse.json(results.slice(0, limit))
  } catch (error) {
    console.error('Error searching ingredients:', error)
    return NextResponse.json({ error: 'Failed to search ingredients' }, { status: 500 })
  }
}
