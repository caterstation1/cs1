// The costed line tree behind one variant, priced with the operator's sheet.
//
// Read-only. The Recipe Builder's equivalent endpoint also accepts edits; here
// the operator is a guest looking at someone else's recipes, and the only thing
// they may change is what they pay for an ingredient.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DraftEntry, buildLabIndex } from '@/lib/pricing/pricesheet'
import { buildRecipeTree } from '@/lib/pricing/tree'
import { requireLabRole } from '../../authz'

export const maxDuration = 300

const SOURCES = ['Gilmours', 'Bidfood', 'ProduceCo', 'Other'] as const
const SIZE_UNITS = ['kg', 'g', 'l', 'ml', 'each'] as const

const previewSchema = z.object({
  sheetId: z.string().nullish(),
  drafts: z
    .array(
      z.object({
        source: z.enum(SOURCES),
        sourceId: z.string().trim().min(1),
        supplierName: z.string().trim().max(120).nullish(),
        packPrice: z.number().nonnegative().finite().nullable(),
        unitsPerPack: z.number().positive().finite().default(1),
        sizePerUnit: z.number().positive().finite().default(1),
        sizeUnit: z.enum(SIZE_UNITS).default('each'),
      })
    )
    .max(2000)
    .default([]),
})

async function tree(variantId: string, sheetId: string | null | undefined, drafts?: DraftEntry[]) {
  const { index } = await buildLabIndex({ sheetId, drafts })
  const built = buildRecipeTree('product', variantId, index)
  if (!built) return null
  // Dietary and usedIn belong to the Recipe Builder's job, not this one.
  return { summary: built.summary, nodes: built.nodes }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { variantId } = await params
  const { searchParams } = new URL(request.url)

  try {
    const built = await tree(variantId, searchParams.get('sheetId'))
    if (!built) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    return NextResponse.json(built)
  } catch (error) {
    console.error('❌ /api/pricing/lab/recipe GET failed:', error)
    return NextResponse.json({ error: 'Failed to load recipe' }, { status: 500 })
  }
}

/** Same tree, with unsaved edits applied — so it agrees with the variants table. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { variantId } = await params
  const parsed = previewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    const built = await tree(variantId, parsed.data.sheetId, parsed.data.drafts)
    if (!built) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    return NextResponse.json(built)
  } catch (error) {
    console.error('❌ /api/pricing/lab/recipe POST failed:', error)
    return NextResponse.json({ error: 'Failed to load recipe' }, { status: 500 })
  }
}
