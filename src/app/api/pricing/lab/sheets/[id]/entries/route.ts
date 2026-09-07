// The Save button.
//
// The client sends every row it has edited since it loaded. A row with a price
// is upserted; a row with a null price is removed, which reverts that
// ingredient to the house price. Both happen in one transaction so a partial
// save can't leave the operator looking at a sheet that is half theirs.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { deriveSheetUnitCost } from '@/lib/pricing/pricesheet'
import { requireLabRole } from '../../../authz'

const SOURCES = ['Gilmours', 'Bidfood', 'ProduceCo', 'Other'] as const
const SIZE_UNITS = ['kg', 'g', 'l', 'ml', 'each'] as const

const entrySchema = z.object({
  source: z.enum(SOURCES),
  sourceId: z.string().trim().min(1),
  supplierName: z.string().trim().max(120).nullish(),
  /** Null clears the operator's price for this ingredient. */
  packPrice: z.number().nonnegative().finite().nullable(),
  unitsPerPack: z.number().positive().finite().default(1),
  sizePerUnit: z.number().positive().finite().default(1),
  sizeUnit: z.enum(SIZE_UNITS).default('each'),
})

const bodySchema = z.object({
  entries: z.array(entrySchema).max(2000),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: sheetId } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    const sheet = await prisma.priceSheet.findUnique({ where: { id: sheetId }, select: { id: true } })
    if (!sheet) return NextResponse.json({ error: 'Price sheet not found' }, { status: 404 })

    const removals: Array<{ source: string; sourceId: string }> = []
    const upserts: Array<{
      source: string
      sourceId: string
      supplierName: string | null
      packPrice: number
      unitsPerPack: number
      sizePerUnit: number
      sizeUnit: string
      unitCost: number
      unitCostUnit: string
    }> = []

    for (const entry of parsed.data.entries) {
      if (entry.packPrice == null) {
        removals.push({ source: entry.source, sourceId: entry.sourceId })
        continue
      }
      const derived = deriveSheetUnitCost({
        packPrice: entry.packPrice,
        unitsPerPack: entry.unitsPerPack,
        sizePerUnit: entry.sizePerUnit,
        sizeUnit: entry.sizeUnit,
      })
      if (!derived) {
        return NextResponse.json(
          { error: `Could not work out a unit price for ${entry.source} ${entry.sourceId}. Check the pack size.` },
          { status: 400 }
        )
      }
      upserts.push({
        source: entry.source,
        sourceId: entry.sourceId,
        supplierName: entry.supplierName?.trim() || null,
        packPrice: entry.packPrice,
        unitsPerPack: entry.unitsPerPack,
        sizePerUnit: entry.sizePerUnit,
        sizeUnit: entry.sizeUnit,
        unitCost: derived.unitCost,
        unitCostUnit: derived.unit,
      })
    }

    await prisma.$transaction([
      ...(removals.length
        ? [
            prisma.priceSheetEntry.deleteMany({
              where: { sheetId, OR: removals.map((r) => ({ source: r.source, sourceId: r.sourceId })) },
            }),
          ]
        : []),
      ...upserts.map((u) =>
        prisma.priceSheetEntry.upsert({
          where: { sheetId_source_sourceId: { sheetId, source: u.source, sourceId: u.sourceId } },
          create: { sheetId, ...u },
          update: {
            supplierName: u.supplierName,
            packPrice: u.packPrice,
            unitsPerPack: u.unitsPerPack,
            sizePerUnit: u.sizePerUnit,
            sizeUnit: u.sizeUnit,
            unitCost: u.unitCost,
            unitCostUnit: u.unitCostUnit,
          },
        })
      ),
      prisma.priceSheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } }),
    ])

    const entryCount = await prisma.priceSheetEntry.count({ where: { sheetId } })
    return NextResponse.json({
      success: true,
      saved: upserts.length,
      cleared: removals.length,
      entryCount,
    })
  } catch (error) {
    console.error('❌ /api/pricing/lab/sheets/[id]/entries PUT failed:', error)
    return NextResponse.json({ error: 'Failed to save prices' }, { status: 500 })
  }
}
