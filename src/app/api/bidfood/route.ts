import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordCataloguePriceChanges } from '@/lib/pricing/persist';

export const maxDuration = 300;

// A full catalogue upload is several hundred rows. Sent one at a time that is
// one round trip to Railway each and the function times out before anything
// commits, so the upload silently does nothing.
const UPSERT_CHUNK_SIZE = 100;

type BidfoodUpload = {
  productCode: string;
  brand: string;
  description: string;
  packSize: string;
  ctnQty: string;
  uom: string;
  qty: number;
  lastPricePaid: number;
  totalExGST: number;
  contains: string;
};

function upsertFor(productData: BidfoodUpload) {
  const fields = {
    brand: productData.brand,
    description: productData.description,
    packSize: productData.packSize,
    ctnQty: productData.ctnQty,
    uom: productData.uom,
    qty: productData.qty,
    lastPricePaid: productData.lastPricePaid,
    totalExGST: productData.totalExGST,
    contains: productData.contains,
  };
  // isPreferred and the preferred* fields are intentionally absent from the
  // update: they are set in the app, not in the supplier CSV.
  return prisma.bidfoodProduct.upsert({
    where: { productCode: productData.productCode },
    update: fields,
    create: { productCode: productData.productCode, ...fields },
  });
}

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
    let failedCount = 0;

    for (let i = 0; i < productsToCreate.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = productsToCreate.slice(i, i + UPSERT_CHUNK_SIZE);
      try {
        const saved = await prisma.$transaction(chunk.map(upsertFor));
        createdProducts.push(...saved);
      } catch (error) {
        // One bad row rolls back its whole batch, so retry the batch a row at a
        // time to isolate the failure rather than lose the other 99.
        console.error('❌ Bidfood batch failed, retrying individually:', error);
        for (const productData of chunk) {
          try {
            createdProducts.push(await upsertFor(productData));
          } catch (rowError) {
            failedCount += 1;
            console.error(`❌ Error creating/updating Bidfood product ${productData.productCode}:`, rowError);
          }
        }
      }
    }

    console.log(
      `✅ Created/updated ${createdProducts.length} Bidfood products` +
        (failedCount ? ` (${failedCount} failed)` : '')
    );

    // Build dated price history for linked ingredients; never fail the upload over it.
    try {
      await recordCataloguePriceChanges(
        'Bidfood',
        createdProducts.map((p) => ({ sourceId: p.id, packPrice: p.lastPricePaid })),
        'csv-upload'
      );
    } catch (error) {
      console.error('⚠️ Failed to record Bidfood price points:', error);
    }

    return NextResponse.json(createdProducts, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Bidfood products:', error);
    return NextResponse.json(
      { error: 'Failed to create Bidfood products' },
      { status: 500 }
    );
  }
} 