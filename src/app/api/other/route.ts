import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.otherProduct.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching other products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('📝 Received product data:', body)
    
    // Validate required fields
    if (!body.name || !body.supplier || !body.description || body.cost === undefined) {
      console.error('❌ Missing required fields:', { name: !!body.name, supplier: !!body.supplier, description: !!body.description, cost: body.cost })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const product = await prisma.otherProduct.create({
      data: {
        name: body.name,
        supplier: body.supplier,
        description: body.description,
        cost: parseFloat(body.cost) || 0
      }
    })
    
    console.log(`✅ Created other product: ${product.name}`)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating other product:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to create product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 