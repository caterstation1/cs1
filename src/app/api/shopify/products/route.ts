import { NextResponse } from 'next/server';
import { fetchShopifyProducts } from '../../../../lib/shopify-client';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    console.log('📦 Fetching Shopify products...');
    const shopifyProducts = await fetchShopifyProducts();
    console.log(`✅ Fetched ${shopifyProducts.length} products from Shopify`);

    return NextResponse.json({
      success: true,
      products: shopifyProducts,
      count: shopifyProducts.length
    });
  } catch (error) {
    console.error('❌ Error fetching Shopify products:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Shopify products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('🔄 Syncing Shopify products to PostgreSQL...');
    const shopifyProducts = await fetchShopifyProducts();
    console.log(`📦 Fetched ${shopifyProducts.length} products from Shopify`);
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'default'; // default: create + update
    const doCreate = mode !== 'update-only';
    const doUpdate = mode !== 'create-only';

    // Get existing product IDs to avoid unnecessary database calls
    const existingProductIds = await prisma.productWithCustomData.findMany({
      select: { variantId: true }
    });
    const existingIdsSet = new Set(existingProductIds.map(p => p.variantId));
    
    console.log(`📋 Found ${existingIdsSet.size} existing products in database`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Process products in batches
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < shopifyProducts.length; i += BATCH_SIZE) {
      const batch = shopifyProducts.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shopifyProducts.length / BATCH_SIZE)} (${batch.length} products)`);
      
      // Partition by new vs existing
      const newProducts = batch.filter(product => !existingIdsSet.has(product.id.toString()));
      const existingProducts = batch.filter(product => existingIdsSet.has(product.id.toString()));

      // Create pass (only Shopify-sourced fields + initial record)
      const createPromises = doCreate ? newProducts.map(async (shopifyProduct) => {
        try {
          // Create new product
          await prisma.productWithCustomData.create({
            data: {
              variantId: shopifyProduct.id.toString(),
              shopifyProductId: shopifyProduct.product_id.toString(),
              shopifySku: shopifyProduct.sku,
              shopifyName: shopifyProduct.title, // Variant title
              shopifyTitle: shopifyProduct.product_title, // Base product title
              shopifyPrice: parseFloat(shopifyProduct.price),
              shopifyInventory: shopifyProduct.inventory_quantity,
              // extra fields may not exist in generated types; use type assertion in separate updates
              displayName: shopifyProduct.product_title, // Use base product title as default display name
              isDraft: false,
              totalCost: 0
            }
          });

          // Update optional fields separately to avoid TS type mismatch
          const vendor = (shopifyProduct as any).product_vendor || null
          const market = (shopifyProduct as any).product_market || null
          const hero = (shopifyProduct as any).product_image || null
          if (vendor || market || hero) {
            await (prisma as any).productWithCustomData.update({
              where: { variantId: shopifyProduct.id.toString() },
              data: {
                shopifyVendor: vendor as any,
                shopifyMarket: market as any,
                heroImageUrl: hero as any,
              }
            })
          }

          console.log(`✅ Synced product: ${shopifyProduct.title}`);
          return { success: true, productId: shopifyProduct.id, kind: 'create' };
        } catch (error) {
          console.error(`❌ Error syncing product ${shopifyProduct.id}:`, error);
          return { success: false, productId: shopifyProduct.id, error };
        }
      }) : [];

      // Update pass for existing rows (preserve custom fields)
      const updatePromises = doUpdate ? existingProducts.map(async (shopifyProduct) => {
        try {
          const vendor = (shopifyProduct as any).product_vendor ?? null;
          const market = (shopifyProduct as any).product_market ?? null;
          const hero = (shopifyProduct as any).product_image ?? null;
          if (vendor != null || market != null || hero != null) {
            await (prisma as any).productWithCustomData.update({
              where: { variantId: shopifyProduct.id.toString() },
              data: {
                shopifyVendor: vendor as any,
                shopifyMarket: market as any,
                heroImageUrl: hero as any,
              }
            });
          }
          return { success: true, productId: shopifyProduct.id, kind: 'update' };
        } catch (error) {
          console.error(`❌ Error updating product ${shopifyProduct.id}:`, error);
          return { success: false, productId: shopifyProduct.id, error };
        }
      }) : [];
      
      // Wait for batch to complete
      const batchResults = await Promise.allSettled([...
        createPromises,
        ...updatePromises
      ]);
      
      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            if ((result.value as any).kind === 'update') updated++; else created++;
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      });
      
      // Count skipped depending on mode
      if (!doCreate && doUpdate) {
        // new ones are skipped
        skipped += newProducts.length;
      } else if (doCreate && !doUpdate) {
        // existing ones are skipped
        skipped += existingProducts.length;
      }
      
      // Small delay between batches
      if (i + BATCH_SIZE < shopifyProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Sync completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Shopify products synced to PostgreSQL',
      synced: created, // backward-compat field name
      created,
      updated,
      skipped,
      errors,
      total: shopifyProducts.length
    });

  } catch (error) {
    console.error('❌ Error syncing Shopify products:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync Shopify products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 