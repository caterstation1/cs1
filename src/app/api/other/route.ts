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
    
    const product = await prisma.otherProduct.create({
      data: {
        name: body.name,
        supplier: body.supplier,
        description: body.description,
        cost: body.cost
      }
    })
    
    console.log(`✅ Created other product: ${product.name}`)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating other product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 