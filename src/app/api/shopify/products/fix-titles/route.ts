import { NextResponse } from 'next/server';
import { fetchShopifyProducts } from '../../../../../lib/shopify-client';
import { prisma } from '../../../../../lib/prisma';

export async function POST() {
  try {
    console.log('🔧 Fixing product titles...');
    const shopifyProducts = await fetchShopifyProducts();
    console.log(`📦 Fetched ${shopifyProducts.length} products from Shopify`);

    let updated = 0;
    let errors = 0;

    // Process products in batches
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < shopifyProducts.length; i += BATCH_SIZE) {
      const batch = shopifyProducts.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shopifyProducts.length / BATCH_SIZE)} (${batch.length} products)`);
      
      const batchPromises = batch.map(async (shopifyProduct) => {
        try {
          // Update existing product with correct titles
          const result = await prisma.productWithCustomData.updateMany({
            where: {
              variantId: shopifyProduct.id.toString()
            },
            data: {
              shopifyName: shopifyProduct.title, // Variant title
              shopifyTitle: shopifyProduct.product_title, // Base product title
              displayName: shopifyProduct.product_title // Use base product title as default display name
            }
          });

          if (result.count > 0) {
            console.log(`✅ Updated product: ${shopifyProduct.product_title} -> ${shopifyProduct.title}`);
            return { success: true, productId: shopifyProduct.id, updated: true };
          } else {
            console.log(`⏭️ Product not found: ${shopifyProduct.id}`);
            return { success: true, productId: shopifyProduct.id, updated: false };
          }
        } catch (error) {
          console.error(`❌ Error updating product ${shopifyProduct.id}:`, error);
          return { success: false, productId: shopifyProduct.id, error };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            if (result.value.updated) {
              updated++;
            }
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      });
      
      // Small delay between batches
      if (i + BATCH_SIZE < shopifyProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Title fix completed: ${updated} updated, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Product titles fixed',
      updated,
      errors,
      total: shopifyProducts.length
    });

  } catch (error) {
    console.error('❌ Error fixing product titles:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix product titles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 