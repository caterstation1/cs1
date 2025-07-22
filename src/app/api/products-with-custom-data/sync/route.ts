import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting sync of Shopify products to ProductWithCustomData...')
    
    // Get the base URL from the request
    const baseUrl = request.nextUrl.origin
    
    // Fetch products from Shopify API
    const shopifyResponse = await fetch(`${baseUrl}/api/shopify/products`)
    if (!shopifyResponse.ok) {
      throw new Error('Failed to fetch Shopify products')
    }
    
    const shopifyData = await shopifyResponse.json()
    const variants = shopifyData.variants || []
    
    console.log(`Found ${variants.length} Shopify variants to sync`)
    
    let synced = 0
    let skipped = 0
    let errors = 0
    
    // Process each variant
    for (const variant of variants) {
      try {
        // Ensure all IDs are strings
        const variantId = variant.variant_id?.toString();
        const productId = variant.product_id?.toString();
        console.log('Processing variant:', { variant, variantId, productId });
        if (!variantId || !productId) {
          console.warn('Skipping variant with missing IDs:', variant);
          skipped++;
          continue;
        }
        // Check if product already exists
        const existingProduct = await prisma.productWithCustomData.findUnique({
          where: { variantId }
        });
        if (existingProduct) {
          console.log(`Updating existing productWithCustomData for variantId: ${variantId}`);
          // Update existing product with latest Shopify data
          await prisma.productWithCustomData.update({
            where: { variantId },
            data: {
              shopifyProductId: productId,
              shopifySku: variant.sku,
              shopifyName: variant.product_title, // product_title from API
              shopifyTitle: variant.variant_title, // variant_title from API
              shopifyPrice: parseFloat(variant.price),
              shopifyInventory: parseInt(variant.inventoryQuantity)
            }
          });
          synced++;
        } else {
          console.log(`Creating new productWithCustomData for variantId: ${variantId}`);
          // Create new product
          try {
            const created = await prisma.productWithCustomData.create({
              data: {
                variantId,
                shopifyProductId: productId,
                shopifySku: variant.sku,
                shopifyName: variant.product_title,
                shopifyTitle: variant.variant_title,
                shopifyPrice: variant.price.toString(), // Pass as string for Decimal
                shopifyInventory: parseInt(variant.inventoryQuantity),
                displayName: null,
                meat1: null,
                meat2: null,
                timer1: null,
                timer2: null,
                option1: null,
                option2: null,
                serveware: false,
                isDraft: false,
                ingredients: [],
                totalCost: 0
              }
            });
            console.log('Created productWithCustomData:', created);
          } catch (err) {
            console.error('Error creating productWithCustomData:', err);
            errors++;
          }
          synced++;
        }
      } catch (error) {
        console.error(`Error processing variant ${variant.variant_id}:`, error);
        errors++;
      }
    }
    
    console.log(`Sync completed: ${synced} synced, ${skipped} skipped, ${errors} errors`)
    
    return NextResponse.json({
      success: true,
      result: {
        synced,
        skipped,
        errors
      },
      message: `Successfully synced ${synced} products from Shopify`
    })
    
  } catch (error) {
    console.error('Error syncing products:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync products from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 