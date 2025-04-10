import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/bidfood - Get all Bidfood products
export async function GET() {
  try {
    console.log('Fetching Bidfood products...')
    
    // Check if Prisma client is available
    if (!prisma) {
      console.error('Prisma client is not available')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }
    
    // Check if BidfoodProduct model exists
    if (!prisma.bidfoodProduct) {
      console.error('BidfoodProduct model is not available')
      return NextResponse.json(
        { error: 'Database model not found' },
        { status: 500 }
      )
    }
    
    const products = await prisma.bidfoodProduct.findMany()
    console.log(`Found ${products.length} Bidfood products`)
    
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching Bidfood products:', error)
    return NextResponse.json(
      { error: `Failed to fetch Bidfood products: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// POST /api/bidfood - Create or update Bidfood products
export async function POST(request: NextRequest) {
  try {
    console.log('Processing Bidfood products POST request...')
    
    // Check if Prisma client is available
    if (!prisma) {
      console.error('Prisma client is not available')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }
    
    // Check if BidfoodProduct model exists
    if (!prisma.bidfoodProduct) {
      console.error('BidfoodProduct model is not available')
      return NextResponse.json(
        { error: 'Database model not found' },
        { status: 500 }
      )
    }
    
    const products = await request.json()
    console.log(`Received ${products.length} products to process`)
    
    if (!Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Request body must be an array of products' },
        { status: 400 }
      )
    }
    
    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No products provided' },
        { status: 400 }
      )
    }
    
    // Process each product
    const results = await Promise.all(
      products.map(async (product: any) => {
        try {
          // Validate required fields
          if (!product.productCode) {
            throw new Error('Product code is required')
          }
          
          console.log(`Upserting product with code: ${product.productCode}`)
          
          // Upsert the product (create if doesn't exist, update if it does)
          return prisma.bidfoodProduct.upsert({
            where: { productCode: product.productCode },
            update: {
              brand: product.brand || '',
              description: product.description || '',
              packSize: product.packSize || '',
              ctnQty: product.ctnQty || '',
              uom: product.uom || '',
              qty: typeof product.qty === 'number' ? product.qty : 0,
              lastPricePaid: typeof product.lastPricePaid === 'number' ? product.lastPricePaid : 0,
              totalExGST: typeof product.totalExGST === 'number' ? product.totalExGST : 0,
              contains: product.contains || '',
            },
            create: {
              productCode: product.productCode,
              brand: product.brand || '',
              description: product.description || '',
              packSize: product.packSize || '',
              ctnQty: product.ctnQty || '',
              uom: product.uom || '',
              qty: typeof product.qty === 'number' ? product.qty : 0,
              lastPricePaid: typeof product.lastPricePaid === 'number' ? product.lastPricePaid : 0,
              totalExGST: typeof product.totalExGST === 'number' ? product.totalExGST : 0,
              contains: product.contains || '',
            },
          })
        } catch (error) {
          console.error(`Error processing product ${product.productCode}:`, error)
          throw error
        }
      })
    )
    
    console.log(`Successfully processed ${results.length} products`)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing Bidfood products:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process Bidfood products' },
      { status: 500 }
    )
  }
} 