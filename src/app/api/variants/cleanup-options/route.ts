import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isOptionPart, loadPartArrays, partArraysUpdateData } from '@/lib/variant-part-edit'

// Clears meat/timer values that are provably junk:
//  - at indices beyond the title's actual parts (orphaned by a title change);
//  - at indices >= 2 whose part is an option ("Yes/No …"), which can never
//    carry a meat or timer.
// Indices 0/1 are never touched here: they mirror the legacy meat1/meat2 that
// runsheets and labels read. Three-meat titles keep their index-2 meat.

export async function POST() {
  try {
    const variants = await prisma.productVariant.findMany({
      select: {
        variantId: true,
        shopifyName: true,
        meats: true, timers: true, options: true,
        meat1: true, meat2: true, timer1: true, timer2: true, option1: true, option2: true,
      },
    })

    let scanned = 0
    let cleaned = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      scanned++
      try {
        const arrays = loadPartArrays(v)
        const maxLen = Math.max(arrays.meats.length, arrays.timers.length, arrays.options.length)

        let changed = false
        for (let i = 2; i < maxLen; i++) {
          const orphaned = i >= arrays.parts.length
          const optionOnly = !orphaned && isOptionPart(arrays.parts[i])
          if (!orphaned && !optionOnly) continue
          if (arrays.meats[i] != null && arrays.meats[i] !== '') { arrays.meats[i] = null; changed = true }
          if (arrays.timers[i] != null) { arrays.timers[i] = null; changed = true }
          if (orphaned && arrays.options[i] != null && arrays.options[i] !== '') { arrays.options[i] = null; changed = true }
        }

        if (!changed) continue

        await prisma.productVariant.update({
          where: { variantId: v.variantId },
          data: partArraysUpdateData(arrays),
        })
        cleaned++
      } catch (e) {
        errors.push({ variantId: v.variantId, reason: e instanceof Error ? e.message : 'unknown' })
      }
    }

    return NextResponse.json({ scanned, cleaned, errors })
  } catch (error) {
    console.error('cleanup-options error', error)
    return NextResponse.json({ error: 'Failed to cleanup options' }, { status: 500 })
  }
}
