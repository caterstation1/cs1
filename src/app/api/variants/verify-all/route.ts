import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type VerifyAllPart = {
  partName: string
  meat?: string | null
  timer?: number | null
  option?: string | null
}

type VerifyAllBody = {
  parts: VerifyAllPart[]
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
    const body = (await request.json()) as VerifyAllBody
    if (!body || !Array.isArray(body.parts) || body.parts.length === 0) {
      return NextResponse.json({ error: 'parts[] is required' }, { status: 400 })
    }

    const results: Array<{
      partName: string
      scanned: number
      mismatches: number
      fixed: number
      details: Array<{ variantId: string; idx: number; reason: string }>
    }> = []

    let totalScanned = 0
    let totalMismatches = 0
    let totalFixed = 0

    for (const part of body.parts) {
      const partName = (part.partName || '').trim()
      if (!partName) {
        results.push({ partName, scanned: 0, mismatches: 0, fixed: 0, details: [] })
        continue
      }

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

      const details: Array<{ variantId: string; idx: number; reason: string }> = []
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

        // Only consider fields that are provided in the request for this part
        const checkMeat = part.meat !== undefined
        const checkTimer = part.timer !== undefined
        const checkOption = part.option !== undefined

        let didFix = false
        for (const idx of indices) {
          const allowMeatTimer = idx < 2
          const missingMeat = allowMeatTimer && checkMeat && ((meats[idx] ?? '').toString().trim() === '')
          const missingTimer = allowMeatTimer && checkTimer && timers[idx] == null
          const missingOption = checkOption && ((options[idx] ?? '').toString().trim() === '')

          if (missingMeat || missingTimer || missingOption) {
            details.push({ variantId: v.variantId, idx, reason: `${missingMeat?'meat ':''}${missingTimer?'timer ':''}${missingOption?'option ':''}`.trim() })
            if (body.fix) {
              ensureLen(meats, idx); ensureLen(timers, idx); ensureLen(options, idx)
              if (allowMeatTimer && missingMeat) meats[idx] = (part.meat ?? null) as string | null
              if (allowMeatTimer && missingTimer) timers[idx] = (part.timer ?? null) as number | null
              if (missingOption) options[idx] = (part.option ?? null) as string | null
              didFix = true
            }
          }
        }
        if (body.fix && didFix) {
          const updateData: any = { meats, timers, options }
          // Mirror to legacy for index 0/1
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

      results.push({ partName, scanned: variants.length, mismatches: details.length, fixed, details: details.slice(0, 50) })
      totalScanned += variants.length
      totalMismatches += details.length
      totalFixed += fixed
    }

    return NextResponse.json({
      summary: {
        parts: body.parts.length,
        totalScanned,
        totalMismatches,
        totalFixed,
      },
      results,
    })
  } catch (error) {
    console.error('verify-all error', error)
    return NextResponse.json({ error: 'Failed to verify all' }, { status: 500 })
  }
}


