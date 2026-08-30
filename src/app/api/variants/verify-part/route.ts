import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { applyPartEdit, loadPartArrays, partArraysUpdateData } from '@/lib/variant-part-edit'

type VerifyPartBody = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
  fix?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyPartBody
    const partName = (body.partName || '').trim()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })

    const variants = await prisma.productVariant.findMany({
      where: { shopifyName: { contains: partName, mode: 'insensitive' } },
      select: {
        variantId: true,
        shopifyName: true,
        meats: true, timers: true, options: true,
        meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
      },
    })

    const mismatches: Array<{ variantId: string; idx: number }> = []
    let fixed = 0

    for (const v of variants) {
      const arrays = loadPartArrays(v)
      const touched = applyPartEdit(
        arrays,
        partName,
        {
          ...(body.meat !== undefined ? { meat: body.meat } : {}),
          ...(body.timer !== undefined ? { timer: body.timer } : {}),
          ...(body.option !== undefined ? { option: body.option } : {}),
        },
        { onlyIfMissing: true }
      )
      if (touched.length === 0) continue

      touched.forEach((idx) => mismatches.push({ variantId: v.variantId, idx }))
      if (body.fix) {
        await prisma.productVariant.update({
          where: { variantId: v.variantId },
          data: partArraysUpdateData(arrays),
        })
        fixed++
      }
    }

    return NextResponse.json({ scanned: variants.length, mismatches: mismatches.length, fixed, details: mismatches.slice(0, 20) })
  } catch (error) {
    console.error('verify-part error', error)
    return NextResponse.json({ error: 'Failed to verify part' }, { status: 500 })
  }
}
