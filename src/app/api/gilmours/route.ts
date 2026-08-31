import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordCataloguePriceChanges } from '@/lib/pricing/persist';

export const maxDuration = 300;

// A full catalogue upload is ~500 rows. Sent one at a time that is ~500 round
// trips to Railway and the function times out before anything commits, so the
// upload silently does nothing. Batched, it is a handful of round trips.
const UPSERT_CHUNK_SIZE = 100;

type GilmoursUpload = {
  sku: string;
  brand: string;
  description: string;
  packSize: string;
  uom: string;
  price: number;
  quantity: number;
};

function upsertFor(productData: GilmoursUpload) {
  const fields = {
    brand: productData.brand,
    description: productData.description,
    packSize: productData.packSize,
    uom: productData.uom,
    price: productData.price,
    quantity: productData.quantity,
  };
  // isPreferred and the preferred* fields are intentionally absent from the
  // update: they are set in the app, not in the supplier CSV.
  return prisma.gilmoursProduct.upsert({
    where: { sku: productData.sku },
    update: fields,
    create: { sku: productData.sku, ...fields },
  });
}

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
    let failedCount = 0;

    for (let i = 0; i < productsToCreate.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = productsToCreate.slice(i, i + UPSERT_CHUNK_SIZE);
      try {
        const saved = await prisma.$transaction(chunk.map(upsertFor));
        createdProducts.push(...saved);
      } catch (error) {
        // One bad row rolls back its whole batch, so retry the batch a row at a
        // time to isolate the failure rather than lose the other 99.
        console.error('❌ Gilmours batch failed, retrying individually:', error);
        for (const productData of chunk) {
          try {
            createdProducts.push(await upsertFor(productData));
          } catch (rowError) {
            failedCount += 1;
            console.error(`❌ Error creating/updating Gilmours product ${productData.sku}:`, rowError);
          }
        }
      }
    }

    console.log(
      `✅ Created/updated ${createdProducts.length} Gilmours products` +
        (failedCount ? ` (${failedCount} failed)` : '')
    );

    // Build dated price history for linked ingredients; never fail the upload over it.
    try {
      await recordCataloguePriceChanges(
        'Gilmours',
        createdProducts.map((p) => ({ sourceId: p.id, packPrice: p.price })),
        'csv-upload'
      );
    } catch (error) {
      console.error('⚠️ Failed to record Gilmours price points:', error);
    }

    return NextResponse.json(createdProducts, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating Gilmours products:', error);
    return NextResponse.json(
      { error: 'Failed to create Gilmours products' },
      { status: 500 }
    );
  }
} 