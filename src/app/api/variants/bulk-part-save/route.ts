import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type BulkPartSaveBody = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
  serveware?: boolean
}

function splitParts(title: string): string[] {
  return (title || '')
    .split(' / ')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function ensureLen<T>(arr: (T | null)[], length: number) {
  while (arr.length <= length) arr.push(null)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkPartSaveBody
    const partName = (body.partName || '').trim()
    if (!partName) {
      return NextResponse.json({ error: 'partName is required' }, { status: 400 })
    }

    // Find all variants containing this part
    const variants = await prisma.productVariant.findMany({
      where: { shopifyName: { contains: partName, mode: 'insensitive' } },
      select: {
        id: true,
        variantId: true,
        shopifyName: true,
        meats: true,
        timers: true,
        options: true,
        meat1: true,
        meat2: true,
        timer1: true,
        timer2: true,
        option1: true,
        option2: true,
      },
    })

    let updated = 0
    const errors: Array<{ variantId: string; reason: string }> = []

    for (const v of variants) {
      try {
        const parts = splitParts(v.shopifyName as any)
        const indices = parts.map((p, i) => (p === partName ? i : -1)).filter(i => i >= 0)
        if (indices.length === 0) continue

        const meats: (string | null)[] = Array.isArray(v.meats)
          ? (v.meats as any[]).map((m) => (m ?? null) as string | null)
          : [v.meat1 ?? null, v.meat2 ?? null]
        const timers: (number | null)[] = Array.isArray(v.timers)
          ? (v.timers as any[]).map((t) => (t ?? null) as number | null)
          : [v.timer1 ?? null, v.timer2 ?? null]
        const options: (string | null)[] = Array.isArray(v.options)
          ? (v.options as any[]).map((o) => (o ?? null) as string | null)
          : [v.option1 ?? null, v.option2 ?? null]

        for (const idx of indices) {
          ensureLen(meats, idx)
          ensureLen(timers, idx)
          ensureLen(options, idx)

          // Only write meats/timers for indices 0 and 1. Index >=2 are options-only.
          if (idx < 2) {
            if (body.meat !== undefined) meats[idx] = (body.meat ?? null) as string | null
            if (body.timer !== undefined) timers[idx] = (body.timer ?? null) as number | null
          }
          if (body.option !== undefined) options[idx] = (body.option ?? null) as string | null
        }

        const updateData: any = { meats, timers, options }
        // Mirror to legacy for index 0/1
        if (meats.length > 0) updateData.meat1 = meats[0]
        if (meats.length > 1) updateData.meat2 = meats[1]
        if (timers.length > 0) updateData.timer1 = timers[0]
        if (timers.length > 1) updateData.timer2 = timers[1]
        if (options.length > 0) updateData.option1 = options[0]
        if (options.length > 1) updateData.option2 = options[1]
        
        // Update serveware if provided
        if (body.serveware !== undefined) updateData.serveware = body.serveware

        await prisma.productVariant.update({ where: { variantId: v.variantId }, data: updateData })
        updated++
      } catch (e: any) {
        errors.push({ variantId: v.variantId, reason: e?.message || 'unknown' })
      }
    }

    return NextResponse.json({ updated, errors })
  } catch (error) {
    console.error('bulk-part-save error', error)
    return NextResponse.json({ error: 'Failed to bulk save' }, { status: 500 })
  }
}


