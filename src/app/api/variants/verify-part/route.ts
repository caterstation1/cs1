import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type VerifyPartBody = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
  fix?: boolean
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
    const body = (await request.json()) as VerifyPartBody
    const partName = (body.partName || '').trim()
    if (!partName) return NextResponse.json({ error: 'partName is required' }, { status: 400 })

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

    const mismatches: Array<{ variantId: string; idx: number; reason: string }> = []
    let fixed = 0

    for (const v of variants) {
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

      // Only allow meats/timers to be checked/fixed for indices 0 and 1. Index >=2 are options-only.
      for (const idx of indices) {
        const allowMeatTimer = idx < 2
        const missingMeat = allowMeatTimer && body.meat !== undefined && ((meats[idx] ?? '').toString().trim() === '')
        const missingTimer = allowMeatTimer && body.timer !== undefined && timers[idx] == null
        const missingOption = body.option !== undefined && ((options[idx] ?? '').toString().trim() === '')

        if (missingMeat || missingTimer || missingOption) {
          mismatches.push({ variantId: v.variantId, idx, reason: `${missingMeat?'meat ':''}${missingTimer?'timer ':''}${missingOption?'option ':''}`.trim() })
          if (body.fix) {
            ensureLen(meats, idx); ensureLen(timers, idx); ensureLen(options, idx)
            if (allowMeatTimer && missingMeat) meats[idx] = body.meat ?? null
            if (allowMeatTimer && missingTimer) timers[idx] = body.timer ?? null
            if (missingOption) options[idx] = body.option ?? null
          }
        }
      }
      if (body.fix) {
        const updateData: any = { meats, timers, options }
        if (meats.length > 0) updateData.meat1 = meats[0]
        if (meats.length > 1) updateData.meat2 = meats[1]
        if (timers.length > 0) updateData.timer1 = timers[0]
        if (timers.length > 1) updateData.timer2 = timers[1]
        if (options.length > 0) updateData.option1 = options[0]
        if (options.length > 1) updateData.option2 = options[1]
        await prisma.productVariant.update({ where: { variantId: v.variantId }, data: updateData })
        fixed++
      }
    }

    return NextResponse.json({ scanned: variants.length, mismatches: mismatches.length, fixed, details: mismatches.slice(0, 20) })
  } catch (error) {
    console.error('verify-part error', error)
    return NextResponse.json({ error: 'Failed to verify part' }, { status: 500 })
  }
}


