import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🛒 Fetching Bidfood products from PostgreSQL...');
    
    const products = await prisma.bidfoodProduct.findMany({
      orderBy: {
        brand: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${products.length} Bidfood products`);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('❌ Error fetching Bidfood products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bidfood products' },
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
        const product = await prisma.bidfoodProduct.upsert({
          where: { productCode: productData.productCode },
          update: {
            brand: productData.brand,
            description: productData.description,
            packSize: productData.packSize,
            ctnQty: productData.ctnQty,
            uom: productData.uom,
            qty: productData.qty,
            lastPricePaid: productData.lastPricePaid,
            totalExGST: productData.totalExGST,
            contains: productData.contains
          },
          create: {
            productCode: productData.productCode,
            brand: productData.brand,
            description: productData.description,
            packSize: productData.packSize,
            ctnQty: productData.ctnQty,
            uom: productData.uom,
            qty: productData.qty,
            lastPricePaid: productData.lastPricePaid,
            totalExGST: productData.totalExGST,
            contains: productData.contains
          }
        });
        
        createdProducts.push(product);
      } catch (error) {
        console.error(`❌ Error creating/updating Bidfood product ${productData.productCode}:`, error);
        // Continue with other products even if one fails
      }
    }
    
    console.log(`✅ Created/updated ${createdProducts.length} Bidfood products`);
    return NextResponse.json(createdProducts, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Bidfood products:', error);
    return NextResponse.json(
      { error: 'Failed to create Bidfood products' },
      { status: 500 }
    );
  }
} 