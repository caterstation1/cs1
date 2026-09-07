// Left panel of the Pricing Lab: stations (a Shopify product and its variants)
// with live cost and margin under the operator's own prices.
//
// Costing goes through costVariant, which is the whole point of the rebuild:
// the old page walked ProductVariant.ingredients in the browser and so never
// saw baseIngredients, title options or party-pack contents, which is why its
// margins read far too high.
//
// GET is the saved view. POST is the same thing with unsaved edits applied, so
// the operator can see what a price they are still typing does to margins
// before committing it.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CostResult, costVariant, marginFor } from '@/lib/pricing/cost'
import { DraftEntry, buildLabIndex } from '@/lib/pricing/pricesheet'
import { prisma } from '@/lib/prisma'
import { requireLabRole } from '../authz'

export const maxDuration = 300

export interface LabVariant {
  variantId: string
  name: string
  sku: string | null
  cost: number | null
  rrpInclGst: number
  rrpEx: number
  margin: number | null
  targetRrpEx: number | null
  belowTarget: boolean
  coveragePct: number
  resolvedLines: number
  totalLines: number
  isPartyPack: boolean
}

export interface LabStation {
  id: string
  title: string
  heroImageUrl: string | null
  market: string | null
  /** Best (highest) margin across the station's variants, for the list row. */
  margin: number | null
  belowTarget: boolean
  variants: LabVariant[]
}

const SOURCES = ['Gilmours', 'Bidfood', 'ProduceCo', 'Other'] as const
const SIZE_UNITS = ['kg', 'g', 'l', 'ml', 'each'] as const

const draftSchema = z.object({
  source: z.enum(SOURCES),
  sourceId: z.string().trim().min(1),
  supplierName: z.string().trim().max(120).nullish(),
  packPrice: z.number().nonnegative().finite().nullable(),
  unitsPerPack: z.number().positive().finite().default(1),
  sizePerUnit: z.number().positive().finite().default(1),
  sizeUnit: z.enum(SIZE_UNITS).default('each'),
})

const previewSchema = z.object({
  sheetId: z.string().nullish(),
  includePartyPacks: z.boolean().default(false),
  drafts: z.array(draftSchema).max(2000).default([]),
})

/**
 * Wellington's catalogue is distinguished by a trailing full stop on the
 * product title — an old convention, but the only marker that reliably
 * separates the two cities' duplicated products.
 */
const isWellingtonTitle = (title: string) => title.trim().endsWith('.')

async function loadCatalog(params: {
  sheetId?: string | null
  includePartyPacks: boolean
  drafts?: DraftEntry[]
}) {
  // buildCostIndex fetches only what costing needs, so the display fields —
  // product title, hero image, market tag, pack flags — come from one extra
  // slim query rather than from widening the index for every other caller.
  const [{ index, sheet }, products] = await Promise.all([
    buildLabIndex({ sheetId: params.sheetId, drafts: params.drafts }),
    prisma.shopifyProduct.findMany({
      where: { isActive: true },
      select: {
        id: true,
        productTitle: true,
        displayName: true,
        heroImageUrl: true,
        shopifyMarket: true,
        isPartyPackDefault: true,
        variants: { select: { variantId: true, isPartyPack: true } },
      },
    }),
  ])

  const { targetMargin, gstRate } = index.settings
  const cache = new Map<string, CostResult>()
  const markets = new Set<string>()
  const stations: LabStation[] = []

  for (const product of products) {
    const title = product.displayName?.trim() || product.productTitle
    // The trailing-dot convention lives on the Shopify title; displayName is
    // sometimes a cleaned copy, so check both before showing the station.
    if (isWellingtonTitle(title) || isWellingtonTitle(product.productTitle)) continue

    const variants: LabVariant[] = []
    for (const row of product.variants) {
      const isPartyPack = row.isPartyPack || product.isPartyPackDefault
      if (isPartyPack && !params.includePartyPacks) continue

      const indexed = index.variantsByVariantId.get(row.variantId)
      if (!indexed) continue

      const result = costVariant(row.variantId, index, { cache })
      const m = marginFor(result.total, indexed.shopifyPriceInclGst, gstRate, targetMargin)
      variants.push({
        variantId: row.variantId,
        name: indexed.name,
        sku: indexed.sku,
        cost: result.total,
        rrpInclGst: indexed.shopifyPriceInclGst,
        rrpEx: m.rrpEx,
        margin: m.margin,
        targetRrpEx: m.targetRrpEx,
        belowTarget: m.margin != null && m.margin < targetMargin,
        coveragePct: result.coverage.pct,
        resolvedLines: result.coverage.resolvedLines,
        totalLines: result.coverage.totalLines,
        isPartyPack,
      })
    }

    if (!variants.length) continue
    variants.sort((a, b) => a.name.localeCompare(b.name))

    if (product.shopifyMarket) {
      for (const token of product.shopifyMarket.split(/[\s,/|;]+/g)) {
        if (token.trim()) markets.add(token.trim())
      }
    }

    // The station row shows the healthiest margin it contains, so a station
    // only reads red when every variant in it is short of target.
    const priced = variants.map((v) => v.margin).filter((m): m is number => m != null)
    const margin = priced.length ? Math.max(...priced) : null

    stations.push({
      id: product.id,
      title,
      heroImageUrl: product.heroImageUrl,
      market: product.shopifyMarket,
      margin,
      belowTarget: margin != null && margin < targetMargin,
      variants,
    })
  }

  stations.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))

  return {
    stations,
    markets: [...markets].sort((a, b) => a.localeCompare(b)),
    settings: { targetMargin, gstRate },
    sheet: sheet ? { applied: sheet.applied.size, unmatched: sheet.unmatched.length } : null,
    counts: {
      stations: stations.length,
      variants: stations.reduce((n, s) => n + s.variants.length, 0),
      belowTarget: stations.filter((s) => s.belowTarget).length,
    },
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  try {
    return NextResponse.json(
      await loadCatalog({
        sheetId: searchParams.get('sheetId'),
        includePartyPacks: searchParams.get('includePartyPacks') === 'true',
      })
    )
  } catch (error) {
    console.error('❌ /api/pricing/lab/catalog GET failed:', error)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = previewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    return NextResponse.json(
      await loadCatalog({
        sheetId: parsed.data.sheetId,
        includePartyPacks: parsed.data.includePartyPacks,
        drafts: parsed.data.drafts,
      })
    )
  } catch (error) {
    console.error('❌ /api/pricing/lab/catalog POST failed:', error)
    return NextResponse.json({ error: 'Failed to preview catalog' }, { status: 500 })
  }
}
