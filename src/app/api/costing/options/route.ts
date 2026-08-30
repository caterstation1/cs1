import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { loadCostingCatalogue } from '@/lib/costing/catalogue'
import { normalizeRows } from '@/lib/costing/options'

// The option catalogue: every choice the shop offers, costed once.

export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json(await loadCostingCatalogue())
  } catch (e) {
    console.error('❌ costing options GET error:', e)
    return NextResponse.json({ error: 'Failed to load costing options' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const aliases: string[] = Array.isArray(body?.aliases)
      ? body.aliases.map((a: unknown) => String(a).trim()).filter(Boolean)
      : []

    const option = await prisma.costingOption.create({
      data: {
        name,
        kind: String(body?.kind ?? 'choice'),
        items: normalizeRows(body?.items) as any,
        noIngredients: Boolean(body?.noIngredients),
        notes: body?.notes ? String(body.notes) : null,
        aliases: { create: aliases.filter((a) => a !== name).map((value) => ({ value })) },
      },
      include: { aliases: true },
    })

    return NextResponse.json({ option })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'That option name or spelling is already taken' }, { status: 409 })
    }
    console.error('❌ costing options POST error:', e)
    return NextResponse.json({ error: 'Failed to create option' }, { status: 500 })
  }
}
