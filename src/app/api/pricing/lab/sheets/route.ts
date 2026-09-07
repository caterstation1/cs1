// Price sheets: one per city operator.
//
// A sheet is only a name and a bag of prices. It never affects production
// costing — see src/lib/pricing/pricesheet.ts for why that is structural
// rather than a promise.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireLabRole } from '../authz'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  notes: z.string().trim().max(500).optional(),
})

export async function GET() {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const sheets = await prisma.priceSheet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        notes: true,
        updatedAt: true,
        _count: { select: { entries: true } },
      },
    })
    return NextResponse.json({
      sheets: sheets.map((s) => ({
        id: s.id,
        name: s.name,
        notes: s.notes,
        updatedAt: s.updatedAt,
        entryCount: s._count.entries,
      })),
    })
  } catch (error) {
    console.error('❌ /api/pricing/lab/sheets GET failed:', error)
    return NextResponse.json({ error: 'Failed to load price sheets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireLabRole()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    const session = await getServerSession(authOptions as any)
    const createdBy = (session as any)?.user?.email ?? (session as any)?.user?.name ?? null

    const existing = await prisma.priceSheet.findUnique({ where: { name: parsed.data.name } })
    if (existing) {
      // Reactivating beats erroring: a sheet is usually "deleted" by going
      // inactive, and an operator retyping the city name means to get it back.
      if (existing.isActive) {
        return NextResponse.json({ error: 'A price sheet with that name already exists' }, { status: 409 })
      }
      const revived = await prisma.priceSheet.update({
        where: { id: existing.id },
        data: { isActive: true, notes: parsed.data.notes ?? existing.notes },
      })
      return NextResponse.json({ sheet: { id: revived.id, name: revived.name, notes: revived.notes, entryCount: 0 } })
    }

    const sheet = await prisma.priceSheet.create({
      data: { name: parsed.data.name, notes: parsed.data.notes ?? null, createdBy },
    })
    return NextResponse.json({ sheet: { id: sheet.id, name: sheet.name, notes: sheet.notes, entryCount: 0 } })
  } catch (error) {
    console.error('❌ /api/pricing/lab/sheets POST failed:', error)
    return NextResponse.json({ error: 'Failed to create price sheet' }, { status: 500 })
  }
}
