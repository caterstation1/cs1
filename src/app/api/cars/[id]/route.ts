import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const data = await req.json()
    const car = await prisma.car.update({
      where: { id },
      data: {
        name: data.name,
        rego: data.rego,
        wofExpiry: data.wofExpiry ? new Date(data.wofExpiry) : null,
        regoExpiry: data.regoExpiry ? new Date(data.regoExpiry) : null,
      },
    })
    return NextResponse.json(car)
  } catch (e) {
    console.error('PUT /api/cars/[id] failed', e)
    return NextResponse.json({ error: 'Failed to update car' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await prisma.car.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/cars/[id] failed', e)
    return NextResponse.json({ error: 'Failed to delete car' }, { status: 500 })
  }
}


