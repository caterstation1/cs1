import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Fetching other products...')
    const products = await prisma.otherProduct.findMany({
      orderBy: {
        name: 'asc',
      },
    })
    console.log(`Found ${products.length} other products`)
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching other products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch other products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Processing POST request for other products')
    const products = await request.json()
    console.log(`Received ${products.length} products to process`)
    
    const results = await Promise.all(
      products.map(async (product: any) => {
        console.log(`Upserting product: ${product.name}`)
        return prisma.otherProduct.upsert({
          where: {
            id: product.id || 'new',
          },
          update: {
            name: product.name,
            supplier: product.supplier,
            description: product.description,
            cost: product.cost,
          },
          create: {
            name: product.name,
            supplier: product.supplier,
            description: product.description,
            cost: product.cost,
          },
        })
      })
    )
    
    console.log(`Successfully processed ${results.length} products`)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing other products:', error)
    return NextResponse.json(
      { error: 'Failed to process other products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 