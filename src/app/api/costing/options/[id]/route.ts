import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { normalizeRows } from '@/lib/costing/options'

// Editing one option. Saving does not reprice: a whole-catalogue reprice takes
// the best part of a minute, so it is a separate deliberate step and the
// costing screen shows when one is outstanding.

interface Ctx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body?.kind === 'string') data.kind = body.kind
    if (typeof body?.notes === 'string' || body?.notes === null) data.notes = body.notes || null
    if (body?.items !== undefined) data.items = normalizeRows(body.items) as any
    if (body?.noIngredients !== undefined) {
      data.noIngredients = Boolean(body.noIngredients)
      // The two states are mutually exclusive; keeping stale rows around would
      // make the option look costed the moment the flag is turned back off.
      if (data.noIngredients) data.items = [] as any
    }

    const addAliases: string[] = Array.isArray(body?.addAliases)
      ? body.addAliases.map((a: unknown) => String(a).trim()).filter(Boolean)
      : []
    const removeAliases: string[] = Array.isArray(body?.removeAliases)
      ? body.removeAliases.map((a: unknown) => String(a).trim()).filter(Boolean)
      : []

    const option = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.costingOption.update({ where: { id }, data })
      }
      if (removeAliases.length > 0) {
        await tx.costingOptionAlias.deleteMany({ where: { optionId: id, value: { in: removeAliases } } })
      }
      for (const value of addAliases) {
        // A spelling can only belong to one option, so claiming it moves it.
        await tx.costingOptionAlias.deleteMany({ where: { value } })
        await tx.costingOptionAlias.create({ data: { value, optionId: id } })
      }
      return tx.costingOption.findUnique({ where: { id }, include: { aliases: true } })
    })

    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 })
    return NextResponse.json({ option })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'That option name is already taken' }, { status: 409 })
    }
    console.error('❌ costing option PATCH error:', e)
    return NextResponse.json({ error: 'Failed to save option' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    // Aliases and per-product quantities cascade. The variants keep their
    // titles, so the spellings simply reappear as unassigned.
    await prisma.costingOption.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (e) {
    console.error('❌ costing option DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 })
  }
}
