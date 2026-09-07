import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type PreferredItem = {
  key: string
  source: 'gilmours' | 'bidfood' | 'produce_co' | 'other'
  id: string
  name: string
  code: string
  supplier: string
  preferredReference: string | null
  preferredAllergens: string[]
}

function normalizeAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
        .filter(Boolean)
    )
  )
}

export async function GET() {
  try {
    const [gilmours, bidfood, produceCo, other] = await Promise.all([
      prisma.gilmoursProduct.findMany({
        where: { isPreferred: true },
        select: {
          id: true,
          sku: true,
          brand: true,
          description: true,
          preferredReference: true,
          preferredAllergens: true,
        },
        orderBy: { description: 'asc' },
      }),
      prisma.bidfoodProduct.findMany({
        where: { isPreferred: true },
        select: {
          id: true,
          productCode: true,
          brand: true,
          description: true,
          preferredReference: true,
          preferredAllergens: true,
        },
        orderBy: { description: 'asc' },
      }),
      prisma.produceCoProduct.findMany({
        where: { isPreferred: true },
        select: {
          id: true,
          productCode: true,
          productName: true,
          preferredReference: true,
          preferredAllergens: true,
        },
        orderBy: { productName: 'asc' },
      }),
      prisma.otherProduct.findMany({
        where: { isPreferred: true },
        select: {
          id: true,
          name: true,
          supplier: true,
          preferredReference: true,
          preferredAllergens: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const items: PreferredItem[] = [
      ...gilmours.map((item) => ({
        key: `gilmours:${item.id}`,
        source: 'gilmours' as const,
        id: item.id,
        name: item.preferredReference?.trim() || item.description,
        code: item.sku || '',
        supplier: item.brand || 'Gilmours',
        preferredReference: item.preferredReference || null,
        preferredAllergens: normalizeAllergens(item.preferredAllergens),
      })),
      ...bidfood.map((item) => ({
        key: `bidfood:${item.id}`,
        source: 'bidfood' as const,
        id: item.id,
        name: item.preferredReference?.trim() || item.description,
        code: item.productCode || '',
        supplier: item.brand || 'Bidfood',
        preferredReference: item.preferredReference || null,
        preferredAllergens: normalizeAllergens(item.preferredAllergens),
      })),
      ...produceCo.map((item) => ({
        key: `produce_co:${item.id}`,
        source: 'produce_co' as const,
        id: item.id,
        name: item.preferredReference?.trim() || item.productName,
        code: item.productCode || '',
        supplier: 'Produce Co',
        preferredReference: item.preferredReference || null,
        preferredAllergens: normalizeAllergens(item.preferredAllergens),
      })),
      ...other.map((item) => ({
        key: `other:${item.id}`,
        source: 'other' as const,
        id: item.id,
        name: item.preferredReference?.trim() || item.name,
        code: '',
        supplier: item.supplier || 'Other',
        preferredReference: item.preferredReference || null,
        preferredAllergens: normalizeAllergens(item.preferredAllergens),
      })),
    ].sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('preferred shop items error', error)
    return NextResponse.json({ error: 'Failed to load preferred products' }, { status: 500 })
  }
}
