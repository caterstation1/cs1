import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/gilmours - Get all Gilmours products
export async function GET() {
  try {
    const products = await prisma.gilmoursProduct.findMany()
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching Gilmours products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Gilmours products' },
      { status: 500 }
    )
  }
}

// POST /api/gilmours - Create or update Gilmours products
export async function POST(request: NextRequest) {
  try {
    const products = await request.json()
    
    // Process each product
    const results = await Promise.all(
      products.map(async (product: any) => {
        // Upsert the product (create if doesn't exist, update if it does)
        return prisma.gilmoursProduct.upsert({
          where: { sku: product.sku },
          update: {
            brand: product.brand,
            description: product.description,
            packSize: product.packSize,
            uom: product.uom,
            price: product.price,
            quantity: product.quantity,
          },
          create: {
            sku: product.sku,
            brand: product.brand,
            description: product.description,
            packSize: product.packSize,
            uom: product.uom,
            price: product.price,
            quantity: product.quantity,
          },
        })
      })
    )
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing Gilmours products:', error)
    return NextResponse.json(
      { error: 'Failed to process Gilmours products' },
      { status: 500 }
    )
  }
} 