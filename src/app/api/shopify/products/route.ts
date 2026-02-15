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

    // Get existing variant IDs and product IDs to avoid unnecessary database calls
    const existingVariants = await prisma.productVariant.findMany({
      select: { variantId: true, productId: true, product: { select: { shopifyProductId: true } } }
    });
    const existingVariantIdsSet = new Set(existingVariants.map(v => v.variantId));
    const existingProductIdsSet = new Set(existingVariants.map(v => v.product.shopifyProductId));
    
    console.log(`📋 Found ${existingVariantIdsSet.size} existing variants and ${existingProductIdsSet.size} existing products in database`);

    let createdProducts = 0;
    let createdVariants = 0;
    let updatedProducts = 0;
    let updatedVariants = 0;
    let skipped = 0;
    let errors = 0;

    // Group variants by product
    const productGroups = new Map<string, any[]>();
    for (const shopifyProduct of shopifyProducts) {
      const productId = shopifyProduct.product_id.toString();
      if (!productGroups.has(productId)) {
        productGroups.set(productId, []);
      }
      productGroups.get(productId)!.push(shopifyProduct);
    }

    console.log(`🔄 Processing ${productGroups.size} product groups with ${shopifyProducts.length} total variants`);

    // Process each product group
    for (const [productId, variants] of productGroups) {
      try {
        // Check if product exists, create if not
        let shopifyProductRecord = await prisma.shopifyProduct.findUnique({
          where: { shopifyProductId: productId }
        });

        if (!shopifyProductRecord && doCreate) {
          // Create new product (use first variant for product-level data)
          const firstVariant = variants[0];
          shopifyProductRecord = await prisma.shopifyProduct.create({
            data: {
              shopifyProductId: productId,
              productTitle: firstVariant.product_title,
              displayName: firstVariant.product_title,
              heroImageUrl: (firstVariant as any).product_image || null,
              shopifyVendor: (firstVariant as any).product_vendor || null,
              shopifyMarket: (firstVariant as any).product_market || null,
              isActive: true
            }
          });
          createdProducts++;
          console.log(`✅ Created new product: ${firstVariant.product_title}`);
        } else if (shopifyProductRecord && doUpdate) {
          // Update existing product with latest data
          const firstVariant = variants[0];
          shopifyProductRecord = await prisma.shopifyProduct.update({
            where: { id: shopifyProductRecord.id },
            data: {
              productTitle: firstVariant.product_title,
              heroImageUrl: (firstVariant as any).product_image || shopifyProductRecord.heroImageUrl,
              shopifyVendor: (firstVariant as any).product_vendor || shopifyProductRecord.shopifyVendor,
              shopifyMarket: (firstVariant as any).product_market || shopifyProductRecord.shopifyMarket,
            }
          });
          updatedProducts++;
        }

        if (!shopifyProductRecord) {
          skipped += variants.length;
          continue;
        }

        // Process variants for this product
        for (const variant of variants) {
          if (existingVariantIdsSet.has(variant.id.toString())) {
            // Update existing variant
            if (doUpdate) {
              try {
                await prisma.productVariant.update({
                  where: { variantId: variant.id.toString() },
                  data: {
                    shopifySku: variant.sku,
                    shopifyName: variant.title,
                    shopifyTitle: variant.product_title,
                    shopifyPrice: parseFloat(variant.price),
                    shopifyInventory: variant.inventory_quantity,
                  }
                });
                updatedVariants++;
              } catch (error) {
                console.error(`❌ Error updating variant ${variant.id}:`, error);
                errors++;
              }
            } else {
              skipped++;
            }
          } else {
            // Create new variant
            if (doCreate) {
              try {
                await prisma.productVariant.create({
                  data: {
                    productId: shopifyProductRecord!.id,
                    variantId: variant.id.toString(),
                    shopifySku: variant.sku,
                    shopifyName: variant.title,
                    shopifyTitle: variant.product_title,
                    shopifyPrice: parseFloat(variant.price),
                    shopifyInventory: variant.inventory_quantity,
                    displayName: variant.product_title, // Default to product title
                    isDraft: false,
                    totalCost: 0
                  }
                });
                createdVariants++;
                console.log(`✅ Created variant: ${variant.title}`);
              } catch (error) {
                console.error(`❌ Error creating variant ${variant.id}:`, error);
                errors++;
              }
            } else {
              skipped++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing product group ${productId}:`, error);
        errors += variants.length;
      }
    }

    const created = createdProducts + createdVariants;
    const updated = updatedProducts + updatedVariants;

    console.log(`🎉 Sync completed: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Shopify products synced to PostgreSQL',
      synced: created, // backward-compat field name
      created,
      updated,
      skipped,
      errors,
      total: shopifyProducts.length,
      breakdown: {
        createdProducts,
        createdVariants,
        updatedProducts,
        updatedVariants
      }
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