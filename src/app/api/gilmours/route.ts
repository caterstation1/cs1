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
    
    // Handle both single product and array of products
    const productsToCreate = Array.isArray(body) ? body : [body];
    
    const createdProducts = [];
    
    for (const productData of productsToCreate) {
      try {
        const product = await prisma.gilmoursProduct.upsert({
          where: { sku: productData.sku },
          update: {
            brand: productData.brand,
            description: productData.description,
            packSize: productData.packSize,
            uom: productData.uom,
            price: productData.price,
            quantity: productData.quantity
          },
          create: {
            sku: productData.sku,
            brand: productData.brand,
            description: productData.description,
            packSize: productData.packSize,
            uom: productData.uom,
            price: productData.price,
            quantity: productData.quantity
          }
        });
        
        createdProducts.push(product);
      } catch (error) {
        console.error(`❌ Error creating/updating Gilmours product ${productData.sku}:`, error);
        // Continue with other products even if one fails
      }
    }
    
    console.log(`✅ Created/updated ${createdProducts.length} Gilmours products`);
    return NextResponse.json(createdProducts, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Gilmours products:', error);
    return NextResponse.json(
      { error: 'Failed to create Gilmours products' },
      { status: 500 }
    );
  }
} 