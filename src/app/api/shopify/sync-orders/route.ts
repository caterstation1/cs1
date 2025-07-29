import { NextResponse } from 'next/server';
import { fetchShopifyOrders } from '../../../../lib/shopify-client';
import { transformShopifyOrder } from '../../../../lib/data-transformer';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to sync Shopify orders.'
  }, { status: 405 });
}

export async function POST() {
  try {
    console.log('🔄 Starting Shopify orders sync...');
    
    // 1. Fetch orders from Shopify
    const shopifyOrders = await fetchShopifyOrders();
    console.log(`📦 Fetched ${shopifyOrders.length} orders from Shopify`);
    
    // 2. Process orders in smaller batches to prevent timeouts
    const BATCH_SIZE = 5; // Reduced from 10 to 5
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    
    // 3. Get existing order IDs to avoid unnecessary database calls
    const existingShopifyIds = await prisma.order.findMany({
      select: { shopifyId: true },
      where: { source: 'shopify' }
    });
    const existingIdsSet = new Set(existingShopifyIds.map(o => o.shopifyId));
    
    console.log(`📋 Found ${existingIdsSet.size} existing orders in database`);
    
    for (let i = 0; i < shopifyOrders.length; i += BATCH_SIZE) {
      const batch = shopifyOrders.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shopifyOrders.length / BATCH_SIZE)} (${batch.length} orders)`);
      
      // Filter out orders that already exist
      const newOrders = batch.filter(order => !existingIdsSet.has(order.id.toString()));
      
      if (newOrders.length === 0) {
        console.log(`⏭️ All orders in batch already exist, skipping`);
        skipped += batch.length;
        continue;
      }
      
      // Process only new orders
      const batchPromises = newOrders.map(async (shopifyOrder) => {
        try {
          console.log(`🔄 Processing order ${shopifyOrder.id}...`);
          
          // Transform the Shopify order using business logic
          const transformedOrder = transformShopifyOrder(shopifyOrder);
          
          // Create new order without transaction for speed
          const newOrder = await prisma.order.create({
            data: {
              shopifyId: transformedOrder.shopifyId.toString(),
              orderNumber: parseInt(transformedOrder.orderNumber),
              createdAt: new Date(transformedOrder.createdAt),
              updatedAt: new Date(transformedOrder.updatedAt),
              totalPrice: transformedOrder.totalPrice,
              subtotalPrice: transformedOrder.subtotalPrice,
              totalTax: transformedOrder.totalTax,
              currency: transformedOrder.currency,
              financialStatus: transformedOrder.financialStatus,
              fulfillmentStatus: transformedOrder.fulfillmentStatus,
              tags: transformedOrder.tags,
              note: transformedOrder.notes,
              customerEmail: transformedOrder.customerEmail,
              customerFirstName: transformedOrder.customerFirstName,
              customerLastName: transformedOrder.customerLastName,
              customerPhone: transformedOrder.customerPhone,
              shippingAddress: transformedOrder.shippingAddress,
              lineItems: transformedOrder.lineItems,
              source: 'shopify',
              hasLocalEdits: transformedOrder.hasLocalEdits,
              syncedAt: new Date(transformedOrder.syncedAt),
              deliveryDate: transformedOrder.deliveryDate,
              deliveryTime: transformedOrder.deliveryTime,
              isDispatched: transformedOrder.isDispatched
            }
          });
          
          console.log(`✅ Synced new order ${shopifyOrder.id}`);
          return { success: true, orderId: shopifyOrder.id, skipped: false };
        } catch (err) {
          console.error(`❌ Error syncing order ${shopifyOrder.id}:`, err);
          return { success: false, orderId: shopifyOrder.id, error: err };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            if ('skipped' in result.value && result.value.skipped) {
              skipped++;
            } else {
              synced++;
            }
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      });
      
      // Add skipped count for existing orders
      skipped += (batch.length - newOrders.length);
      
      // Shorter delay between batches
      if (i + BATCH_SIZE < shopifyOrders.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms to 500ms
      }
    }
    
    console.log(`🎉 Sync completed: ${synced} new orders synced, ${skipped} existing orders skipped, ${errors} errors`);
    
    return NextResponse.json({
      message: `Orders synced to PostgreSQL.`,
      synced,
      skipped,
      errors,
      total: shopifyOrders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error syncing orders:', error);
    return NextResponse.json({
      message: 'Error syncing orders',
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 