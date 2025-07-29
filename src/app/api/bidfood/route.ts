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
    
    const product = await prisma.bidfoodProduct.create({
      data: {
        productCode: body.productCode,
        brand: body.brand,
        description: body.description,
        packSize: body.packSize,
        ctnQty: body.ctnQty,
        uom: body.uom,
        qty: body.qty,
        lastPricePaid: body.lastPricePaid,
        totalExGST: body.totalExGST,
        contains: body.contains
      }
    });
    
    console.log(`✅ Created Bidfood product: ${product.brand} - ${product.description}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Bidfood product:', error);
    return NextResponse.json(
      { error: 'Failed to create Bidfood product' },
      { status: 500 }
    );
  }
} 