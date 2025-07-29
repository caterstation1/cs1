import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching products with custom data from PostgreSQL...');
    
    const products = await prisma.productWithCustomData.findMany({
      orderBy: {
        shopifyName: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${products.length} products with custom data`);
    return NextResponse.json(products);
  } catch (error) {
    console.error('❌ Error fetching products with custom data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products with custom data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const product = await prisma.productWithCustomData.create({
      data: {
        variantId: body.variantId,
        shopifyProductId: body.shopifyProductId,
        shopifySku: body.shopifySku,
        shopifyName: body.shopifyName,
        shopifyTitle: body.shopifyTitle,
        shopifyPrice: body.shopifyPrice,
        shopifyInventory: body.shopifyInventory,
        displayName: body.displayName,
        meat1: body.meat1,
        meat2: body.meat2,
        timer1: body.timer1,
        timer2: body.timer2,
        option1: body.option1,
        option2: body.option2,
        serveware: body.serveware || false,
        isDraft: body.isDraft || false,
        ingredients: body.ingredients,
        totalCost: body.totalCost || 0
      }
    });
    
    console.log(`✅ Created product with custom data: ${product.shopifyName}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product with custom data:', error);
    return NextResponse.json(
      { error: 'Failed to create product with custom data' },
      { status: 500 }
    );
  }
} 