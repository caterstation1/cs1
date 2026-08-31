import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordCataloguePriceChanges } from '@/lib/pricing/persist'

export const maxDuration = 300

// A full catalogue upload is several hundred rows. Sent one at a time that is
// one round trip to Railway each and the function times out before anything
// commits, so the upload silently does nothing.
const UPSERT_CHUNK_SIZE = 100

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').trim()
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseIntValue(value: unknown): number {
  const parsed = Math.trunc(parseNumber(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET() {
  try {
    const products = await prisma.produceCoProduct.findMany({
      orderBy: [{ productName: 'asc' }],
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching Produce Co products:', error)
    return NextResponse.json({ error: 'Failed to fetch Produce Co products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const productsToCreate = Array.isArray(body) ? body : [body]

    const upsertFor = (productData: Record<string, unknown>, productCode: string) => {
      const fields = {
        productName: String(productData.productName || ''),
        totalUnits: parseIntValue(productData.totalUnits),
        totalSales: parseNumber(productData.totalSales),
        price: parseNumber(productData.price),
      }
      return prisma.produceCoProduct.upsert({
        where: { productCode },
        update: fields,
        create: { productCode, ...fields },
      })
    }

    const rows = productsToCreate
      .map((productData: Record<string, unknown>) => ({
        productData,
        productCode: String(productData.productCode || '').trim(),
      }))
      .filter((row: { productCode: string }) => row.productCode)

    const createdProducts = []
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
      try {
        const saved = await prisma.$transaction(
          chunk.map((row: { productData: Record<string, unknown>; productCode: string }) =>
            upsertFor(row.productData, row.productCode)
          )
        )
        createdProducts.push(...saved)
      } catch (error) {
        // One bad row rolls back its whole batch, so retry the batch a row at a
        // time to isolate the failure rather than lose the other 99.
        console.error('Produce Co batch failed, retrying individually:', error)
        for (const row of chunk) {
          try {
            createdProducts.push(await upsertFor(row.productData, row.productCode))
          } catch (rowError) {
            console.error(`Error creating/updating Produce Co product ${row.productCode}:`, rowError)
          }
        }
      }
    }

    // Build dated price history for linked ingredients; never fail the upload over it.
    try {
      await recordCataloguePriceChanges(
        'ProduceCo',
        createdProducts.map((p) => ({ sourceId: p.id, packPrice: p.price })),
        'csv-upload'
      )
    } catch (error) {
      console.error('⚠️ Failed to record Produce Co price points:', error)
    }

    return NextResponse.json(createdProducts, { status: 201 })
  } catch (error) {
    console.error('Error creating Produce Co products:', error)
    return NextResponse.json({ error: 'Failed to create Produce Co products' }, { status: 500 })
  }
}
