import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyPartEdit, loadPartArrays, partArraysUpdateData } from '@/lib/variant-part-edit'

type BulkPartSaveBody = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
  serveware?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkPartSaveBody
    const partName = (body.partName || '').trim()
    if (!partName) {
      return NextResponse.json({ error: 'partName is required' }, { status: 400 })
    }

    const variants = await prisma.productVariant.findMany({
      where: { shopifyName: { contains: partName, mode: 'insensitive' } },
      select: {
        variantId: true,
        shopifyName: true,
        meats: true, timers: true, options: true,
        meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
      },
    })

    let updated = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      try {
        const arrays = loadPartArrays(v)
        const touched = applyPartEdit(arrays, partName, {
          ...(body.meat !== undefined ? { meat: body.meat } : {}),
          ...(body.timer !== undefined ? { timer: body.timer } : {}),
          ...(body.option !== undefined ? { option: body.option } : {}),
        })
        // serveware is a variant-level flag; it applies to any variant whose
        // title contains the part even when no per-part field changed.
        const servewareChange = body.serveware !== undefined && arrays.parts.includes(partName)
        if (touched.length === 0 && !servewareChange) continue

        const updateData: Record<string, unknown> = touched.length > 0 ? partArraysUpdateData(arrays) : {}
        if (servewareChange) updateData.serveware = body.serveware

        await prisma.productVariant.update({ where: { variantId: v.variantId }, data: updateData })
        updated++
      } catch (e) {
        errors.push({ variantId: v.variantId, reason: e instanceof Error ? e.message : 'unknown' })
      }
    }

    return NextResponse.json({ updated, errors })
  } catch (error) {
    console.error('bulk-part-save error', error)
    return NextResponse.json({ error: 'Failed to bulk save' }, { status: 500 })
  }
}
