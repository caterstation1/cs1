import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Find all variants containing "Yes Serveware" (case-insensitive)
    const variants = await prisma.productVariant.findMany({
      where: {
        shopifyName: {
          contains: 'Yes Serveware',
          mode: 'insensitive'
        }
      },
      select: {
        variantId: true,
        shopifyName: true,
        serveware: true
      }
    })

    let updated = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      try {
        // Only update if not already set
        if (!v.serveware) {
          await prisma.productVariant.update({
            where: { variantId: v.variantId },
            data: { serveware: true }
          })
          updated++
        }
      } catch (e: any) {
        errors.push({ variantId: v.variantId, reason: e?.message || 'unknown' })
      }
    }

    return NextResponse.json({
      scanned: variants.length,
      updated,
      errors,
      message: `Set serveware=true for ${updated} variants`
    })
  } catch (error) {
    console.error('migrate-serveware error', error)
    return NextResponse.json({ error: 'Failed to migrate serveware' }, { status: 500 })
  }
}



