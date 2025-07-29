import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching products from PostgreSQL...');
    
    const products = await prisma.product.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${products.length} products`);
    return NextResponse.json(products);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        addon: body.addon,
        handle: body.handle,
        meat1: body.meat1,
        meat2: body.meat2,
        option1: body.option1,
        option2: body.option2,
        serveware: body.serveware,
        timerA: body.timerA,
        timerB: body.timerB,
        skuSearch: body.skuSearch,
        variantSku: body.variantSku,
        variant_title: body.variant_title,
        ingredients: body.ingredients,
        totalCost: body.totalCost || 0,
        sellingPrice: body.sellingPrice,
        realizedMargin: body.realizedMargin
      }
    });
    
    console.log(`✅ Created product: ${product.name}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
} 