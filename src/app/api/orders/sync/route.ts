import { NextResponse } from 'next/server';
import { fetchShopifyOrders } from '@/lib/shopify-client';
import { transformShopifyOrder } from '@/lib/data-transformer';
import { prisma } from '@/lib/prisma';
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver';

// Back-compat endpoint used by Orders UI. Delegates to Prisma/Railway sync (not Firestore).
export async function POST() {
  try {
    console.log('🔄 [orders/sync] Starting Shopify orders sync…');
    
    // 1) Fetch from Shopify
    const shopifyOrders = await fetchShopifyOrders();
    console.log(`📦 [orders/sync] Fetched ${shopifyOrders.length} orders from Shopify`);
    
    // 2) Gather existing Shopify IDs to skip already-saved orders
    const existingShopifyIds = await prisma.order.findMany({
      select: { shopifyId: true },
      where: { source: 'shopify' }
    });
    const existingIds = new Set(existingShopifyIds.map(o => o.shopifyId));
    console.log(`📋 [orders/sync] Found ${existingIds.size} existing orders in DB`);
    
    // 3) Batch process to avoid timeouts
    const BATCH_SIZE = 5;
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < shopifyOrders.length; i += BATCH_SIZE) {
      const batch = shopifyOrders.slice(i, i + BATCH_SIZE);
      console.log(`🔁 [orders/sync] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shopifyOrders.length / BATCH_SIZE)} size=${batch.length}`);
      
      const newOrders = batch.filter(o => !existingIds.has(o.id.toString()));
      if (newOrders.length === 0) {
        skipped += batch.length;
        continue;
      }
      
      const results = await Promise.allSettled(newOrders.map(async (order) => {
        try {
          const transformed = transformShopifyOrder(order);
          const resolved = resolveDeliveryDateResolved({
            deliveryDate: transformed.deliveryDate,
            tags: transformed.tags,
            createdAt: transformed.createdAt,
          });
          
          await prisma.order.create({
            data: {
              shopifyId: transformed.shopifyId.toString(),
              orderNumber: parseInt(transformed.orderNumber),
              createdAt: new Date(transformed.createdAt),
              updatedAt: new Date(transformed.updatedAt),
              totalPrice: transformed.totalPrice,
              subtotalPrice: transformed.subtotalPrice,
              totalTax: transformed.totalTax,
              currency: transformed.currency,
              financialStatus: transformed.financialStatus,
              fulfillmentStatus: transformed.fulfillmentStatus ?? null,
              tags: transformed.tags,
              note: transformed.notes ?? null,
              customerEmail: transformed.customerEmail,
              customerFirstName: transformed.customerFirstName,
              customerLastName: transformed.customerLastName,
              customerPhone: transformed.customerPhone,
              shippingAddress: transformed.shippingAddress as any,
              lineItems: transformed.lineItems as any,
              source: 'shopify',
              hasLocalEdits: false,
              syncedAt: new Date(transformed.syncedAt),
              deliveryDate: transformed.deliveryDate,
              deliveryTime: transformed.deliveryTime,
              isDispatched: transformed.isDispatched,
              deliveryDateResolved: (resolved.date as unknown as Date) ?? null,
              deliveryDateResolvedSource: (resolved.source as any) ?? null,
              deliveryDateResolvedAt: new Date(),
            }
          });
          
          return { ok: true };
        } catch (err) {
          console.error('❌ [orders/sync] Failed to create order:', err);
          return { ok: false, err };
        }
      }));
      
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.ok) synced++;
          else errors++;
        } else {
          errors++;
        }
      }
      
      // Count already-existing ones as skipped
      skipped += (batch.length - newOrders.length);
      
      if (i + BATCH_SIZE < shopifyOrders.length) {
        await new Promise(res => setTimeout(res, 500));
      }
    }
    
    console.log(`🎉 [orders/sync] Complete: synced=${synced}, skipped=${skipped}, errors=${errors}`);
    return NextResponse.json({
      message: 'Orders synced to PostgreSQL.',
      result: { synced, skipped, errors },
      total: shopifyOrders.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [orders/sync] Error syncing orders:', error);
    return NextResponse.json({
      message: 'Error syncing orders',
      error: error instanceof Error ? error.message : error,
      result: null,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
