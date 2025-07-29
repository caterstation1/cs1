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

export async function POST() {
  try {
    console.log('🔄 Syncing Shopify products to PostgreSQL...');
    const shopifyProducts = await fetchShopifyProducts();
    console.log(`📦 Fetched ${shopifyProducts.length} products from Shopify`);

    // Get existing product IDs to avoid unnecessary database calls
    const existingProductIds = await prisma.productWithCustomData.findMany({
      select: { variantId: true }
    });
    const existingIdsSet = new Set(existingProductIds.map(p => p.variantId));
    
    console.log(`📋 Found ${existingIdsSet.size} existing products in database`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process products in batches
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < shopifyProducts.length; i += BATCH_SIZE) {
      const batch = shopifyProducts.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shopifyProducts.length / BATCH_SIZE)} (${batch.length} products)`);
      
      // Filter out products that already exist
      const newProducts = batch.filter(product => !existingIdsSet.has(product.id.toString()));
      
      if (newProducts.length === 0) {
        console.log(`⏭️ All products in batch already exist, skipping`);
        skipped += batch.length;
        continue;
      }
      
      // Process only new products
      const batchPromises = newProducts.map(async (shopifyProduct) => {
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
              displayName: shopifyProduct.product_title, // Use base product title as default display name
              isDraft: false,
              totalCost: 0
            }
          });

          console.log(`✅ Synced product: ${shopifyProduct.title}`);
          return { success: true, productId: shopifyProduct.id };
        } catch (error) {
          console.error(`❌ Error syncing product ${shopifyProduct.id}:`, error);
          return { success: false, productId: shopifyProduct.id, error };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            synced++;
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      });
      
      // Add skipped count for existing products
      skipped += (batch.length - newProducts.length);
      
      // Small delay between batches
      if (i + BATCH_SIZE < shopifyProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Sync completed: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Shopify products synced to PostgreSQL',
      synced,
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