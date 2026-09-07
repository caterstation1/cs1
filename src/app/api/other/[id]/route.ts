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
    const product = await prisma.otherProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch {
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
      listOnLabel?: boolean
      isVegetarian?: boolean
      isVegan?: boolean
      isHalal?: boolean
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
    if (typeof body.listOnLabel === 'boolean') {
      updateData.listOnLabel = body.listOnLabel
    }
    if (typeof body.isVegetarian === 'boolean') {
      updateData.isVegetarian = body.isVegetarian
    }
    if (typeof body.isVegan === 'boolean') {
      updateData.isVegan = body.isVegan
    }
    if (typeof body.isHalal === 'boolean') {
      updateData.isHalal = body.isHalal
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error:
            'No valid fields provided. Use isPreferred, preferredReference, preferredAllergens, and/or dietary flags.',
        },
        { status: 400 }
      )
    }

    const updated = await prisma.otherProduct.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
