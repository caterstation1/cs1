import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🛒 Fetching Gilmours products from PostgreSQL...');
    
    const products = await prisma.gilmoursProduct.findMany({
      orderBy: {
        brand: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${products.length} Gilmours products`);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('❌ Error fetching Gilmours products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gilmours products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const product = await prisma.gilmoursProduct.create({
      data: {
        sku: body.sku,
        brand: body.brand,
        description: body.description,
        packSize: body.packSize,
        uom: body.uom,
        price: body.price,
        quantity: body.quantity
      }
    });
    
    console.log(`✅ Created Gilmours product: ${product.brand} - ${product.description}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Gilmours product:', error);
    return NextResponse.json(
      { error: 'Failed to create Gilmours product' },
      { status: 500 }
    );
  }
} 