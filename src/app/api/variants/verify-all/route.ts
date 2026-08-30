import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyPartEdit, loadPartArrays, partArraysUpdateData, splitParts } from '@/lib/variant-part-edit'
import { recalcAll } from '@/lib/pricing/recalc'
import { getAlignments, missingAlignedRows, normalizeRows, type RecipeRow } from '@/lib/variant-part-components'

// Fixing alignments can touch thousands of variants across hundreds of parts,
// and finishes with a whole-catalogue reprice.
export const maxDuration = 300

type VerifyAllPart = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
}

type VerifyAllBody = {
  parts: VerifyAllPart[]
  fix?: boolean
  /** Also add each part's aligned item to variants missing it. Default on. */
  applyAlignment?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyAllBody
    if (!body || !Array.isArray(body.parts) || body.parts.length === 0) {
      return NextResponse.json({ error: 'parts[] is required' }, { status: 400 })
    }

    const applyAlignment = body.applyAlignment !== false
    const alignments = applyAlignment
      ? await getAlignments(body.parts.map((p) => (p.partName || '').trim()).filter(Boolean))
      : new Map<string, RecipeRow[]>()

    const results: Array<{
      partName: string
      scanned: number
      mismatches: number
      fixed: number
      alignedItems: number
      alignmentGaps: number
      alignmentFixed: number
      details: Array<{ variantId: string; idx: number }>
      alignmentDetails: Array<{ variantId: string; shopifyName: string; added: string[] }>
    }> = []

    let totalScanned = 0
    let totalMismatches = 0
    let totalFixed = 0
    let totalAlignmentGaps = 0
    let totalAlignmentFixed = 0

    for (const part of body.parts) {
      const partName = (part.partName || '').trim()
      if (!partName) {
        results.push({
          partName,
          scanned: 0,
          mismatches: 0,
          fixed: 0,
          alignedItems: 0,
          alignmentGaps: 0,
          alignmentFixed: 0,
          details: [],
          alignmentDetails: [],
        })
        continue
      }

      const aligned = alignments.get(partName) ?? []

      const variants = await prisma.productVariant.findMany({
        where: { shopifyName: { contains: partName, mode: 'insensitive' } },
        select: {
          variantId: true,
          shopifyName: true,
          meats: true, timers: true, options: true,
          meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
          ingredients: true,
        },
      })

      const details: Array<{ variantId: string; idx: number }> = []
      const alignmentDetails: Array<{ variantId: string; shopifyName: string; added: string[] }> = []
      let fixed = 0
      let alignmentGaps = 0
      let alignmentFixed = 0

      for (const v of variants) {
        // `contains` can match inside a longer segment, so confirm the part is
        // a whole ' / ' segment before touching anything.
        const isExactPart = splitParts(v.shopifyName).includes(partName)

        const arrays = loadPartArrays(v)
        const touched = applyPartEdit(
          arrays,
          partName,
          {
            ...(part.meat !== undefined ? { meat: part.meat } : {}),
            ...(part.timer !== undefined ? { timer: part.timer } : {}),
            ...(part.option !== undefined ? { option: part.option } : {}),
          },
          { onlyIfMissing: true }
        )

        // Any item this part is aligned to that the variant does not carry.
        const missing = isExactPart && aligned.length > 0
          ? missingAlignedRows(normalizeRows(v.ingredients), aligned)
          : []
        if (missing.length > 0) alignmentGaps++

        if (touched.length === 0 && missing.length === 0) continue
        touched.forEach((idx) => details.push({ variantId: v.variantId, idx }))

        if (body.fix) {
          const data: Record<string, unknown> = {}
          if (touched.length > 0) Object.assign(data, partArraysUpdateData(arrays))
          if (missing.length > 0) {
            data.ingredients = [...normalizeRows(v.ingredients), ...missing] as any
          }
          await prisma.productVariant.update({ where: { variantId: v.variantId }, data })
          if (touched.length > 0) fixed++
          if (missing.length > 0) {
            alignmentFixed++
            alignmentDetails.push({
              variantId: v.variantId,
              shopifyName: v.shopifyName,
              added: missing.map((m) => m.name),
            })
          }
        }
      }

      results.push({
        partName,
        scanned: variants.length,
        mismatches: details.length,
        fixed,
        alignedItems: aligned.length,
        alignmentGaps,
        alignmentFixed,
        details: details.slice(0, 50),
        alignmentDetails: alignmentDetails.slice(0, 50),
      })
      totalScanned += variants.length
      totalMismatches += details.length
      totalFixed += fixed
      totalAlignmentGaps += alignmentGaps
      totalAlignmentFixed += alignmentFixed
    }

    // Adding aligned items changes recipes, and costing reads the live
    // ProductVariant.totalCost, so reprice before returning.
    let recalc: { variants: number; components: number } | null = null
    if (totalAlignmentFixed > 0) {
      try {
        const report = await recalcAll('manual')
        recalc = { variants: report.variants.updated, components: report.components.updated }
      } catch (e) {
        console.error('recalc after verify-all alignment fix failed', e)
      }
    }

    return NextResponse.json({
      summary: {
        parts: body.parts.length,
        totalScanned,
        totalMismatches,
        totalFixed,
        totalAlignmentGaps,
        totalAlignmentFixed,
        partsWithAlignment: alignments.size,
      },
      recalc,
      results,
    })
  } catch (error) {
    console.error('verify-all error', error)
    return NextResponse.json({ error: 'Failed to verify all' }, { status: 500 })
  }
}
