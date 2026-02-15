import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const variants = await prisma.productVariant.findMany({
      select: {
        variantId: true,
        meats: true,
        timers: true,
        meat1: true,
        meat2: true,
        timer1: true,
        timer2: true,
      },
    })

    let scanned = 0
    let cleaned = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      scanned++
      try {
        const meatsArr: (string | null)[] = Array.isArray(v.meats)
          ? (v.meats as any[]).map((m) => (m ?? null) as string | null)
          : [v.meat1 ?? null, v.meat2 ?? null]
        const timersArr: (number | null)[] = Array.isArray(v.timers)
          ? (v.timers as any[]).map((t) => (t ?? null) as number | null)
          : [v.timer1 ?? null, v.timer2 ?? null]

        let changed = false
        // Null out indices >= 2 for meats and timers
        for (let i = 2; i < Math.max(meatsArr.length, timersArr.length); i++) {
          if (meatsArr[i] != null && meatsArr[i] !== '') { meatsArr[i] = null; changed = true }
          if (timersArr[i] != null) { timersArr[i] = null; changed = true }
        }

        if (!changed) continue

        const updateData: any = { meats: meatsArr, timers: timersArr }
        // Mirror back to legacy fields (0/1)
        if (meatsArr.length > 0) updateData.meat1 = meatsArr[0]
        if (meatsArr.length > 1) updateData.meat2 = meatsArr[1]
        if (timersArr.length > 0) updateData.timer1 = timersArr[0]
        if (timersArr.length > 1) updateData.timer2 = timersArr[1]

        await prisma.productVariant.update({ where: { variantId: v.variantId }, data: updateData })
        cleaned++
      } catch (e: any) {
        errors.push({ variantId: v.variantId, reason: e?.message || 'unknown' })
      }
    }

    return NextResponse.json({ scanned, cleaned, errors })
  } catch (error) {
    console.error('cleanup-options error', error)
    return NextResponse.json({ error: 'Failed to cleanup options' }, { status: 500 })
  }
}




