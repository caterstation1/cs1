import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching products from PostgreSQL...');
    
    const products = await prisma.shopifyProduct.findMany({
      include: {
        variants: {
          orderBy: {
            shopifyName: 'asc'
          }
        }
      },
      orderBy: {
        productTitle: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${products.length} products with variants`);
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
    
    // For now, we'll handle this through the Shopify sync
    // This endpoint can be used for manual product creation if needed
    const product = await prisma.shopifyProduct.create({
      data: {
        shopifyProductId: body.shopifyProductId,
        productTitle: body.productTitle,
        displayName: body.displayName,
        heroImageUrl: body.heroImageUrl,
        shopifyVendor: body.shopifyVendor,
        shopifyMarket: body.shopifyMarket,
        isActive: body.isActive ?? true
      },
      include: {
        variants: true
      }
    });
    
    console.log(`✅ Created product: ${product.productTitle}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
} 