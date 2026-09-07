import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function normalizePreferredAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
        .filter(Boolean)
    )
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.bidfoodProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const updateData: {
      isPreferred?: boolean
      preferredReference?: string | null
      preferredAllergens?: string[]
    } = {}
    if (typeof body.isPreferred === 'boolean') {
      updateData.isPreferred = body.isPreferred
    }
    if (body.preferredReference !== undefined) {
      updateData.preferredReference =
        typeof body.preferredReference === 'string'
          ? body.preferredReference.trim() || null
          : null
    }
    if (body.preferredAllergens !== undefined) {
      updateData.preferredAllergens = normalizePreferredAllergens(body.preferredAllergens)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided. Use isPreferred, preferredReference, and/or preferredAllergens.' },
        { status: 400 }
      )
    }

    const updated = await prisma.bidfoodProduct.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}








