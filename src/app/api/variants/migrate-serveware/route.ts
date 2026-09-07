import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Syncs the serveware flag from the variant title where the title states it
// explicitly: "… Yes Serveware …" → true, "… No Serveware …" → false.
// Titles that don't mention serveware keep their manual flag.

export async function POST() {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { shopifyName: { contains: 'serveware', mode: 'insensitive' } },
      select: { variantId: true, shopifyName: true, serveware: true },
    })

    let setTrue = 0
    let setFalse = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      const saysYes = /yes serveware/i.test(v.shopifyName)
      const saysNo = /no serveware/i.test(v.shopifyName)
      // Contradictory titles ("Yes Serveware / No Serveware") don't occur, but
      // if one ever did, leave it alone rather than guess.
      if (saysYes === saysNo) continue
      const want = saysYes
      if (v.serveware === want) continue

      try {
        await prisma.productVariant.update({
          where: { variantId: v.variantId },
          data: { serveware: want },
        })
        if (want) setTrue++
        else setFalse++
      } catch (e) {
        errors.push({ variantId: v.variantId, reason: e instanceof Error ? e.message : 'unknown' })
      }
    }

    return NextResponse.json({
      scanned: variants.length,
      updated: setTrue + setFalse,
      setTrue,
      setFalse,
      errors,
      message: `Serveware synced from titles: ${setTrue} set to yes, ${setFalse} set to no`,
    })
  } catch (error) {
    console.error('migrate-serveware error', error)
    return NextResponse.json({ error: 'Failed to migrate serveware' }, { status: 500 })
  }
}
