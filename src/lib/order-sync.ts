import { fetchShopifyOrders } from '@/lib/shopify-client';
import { transformShopifyOrder } from '@/lib/data-transformer';
import { prisma } from '@/lib/prisma';
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver';
import { canonicalizeOrderScheduling } from '@/lib/order-canonicalize';
import { parseAndUpsertCompanyForOrder } from '@/lib/company-matching';

export interface OrderSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  needsReviewCount: number;
  needsReviewOrderNumbers: number[];
  total: number;
}

// Fetches recent orders from Shopify and inserts any that aren't already in the DB.
// Shared by the Orders UI sync endpoint and the server-side sync cron.
export async function syncShopifyOrders(): Promise<OrderSyncResult> {
  // 1) Fetch from Shopify
  const shopifyOrders = await fetchShopifyOrders();
  console.log(`📦 [order-sync] Fetched ${shopifyOrders.length} orders from Shopify`);

  // 2) Gather existing Shopify IDs to skip already-saved orders
  const existingShopifyIds = await prisma.order.findMany({
    select: { shopifyId: true },
    where: { source: 'shopify' }
  });
  const existingIds = new Set(existingShopifyIds.map(o => o.shopifyId));
  console.log(`📋 [order-sync] Found ${existingIds.size} existing orders in DB`);

  // 3) Batch process to avoid timeouts
  const BATCH_SIZE = 5;
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let needsReviewCount = 0;
  const needsReviewOrderNumbers: number[] = [];

  for (let i = 0; i < shopifyOrders.length; i += BATCH_SIZE) {
    const batch = shopifyOrders.slice(i, i + BATCH_SIZE);

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

        // Apply canonical scheduling fields
        // Note: transformed doesn't have noteAttributes, but we can get it from the raw order
        const scheduling = canonicalizeOrderScheduling({
          deliveryDate: transformed.deliveryDate,
          deliveryTime: transformed.deliveryTime,
          tags: transformed.tags,
          createdAt: transformed.createdAt,
          shippingAddress: transformed.shippingAddress,
          lineItems: transformed.lineItems,
          noteAttributes: order.note_attributes, // Use raw Shopify order
          note_attributes: order.note_attributes,
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
            // New canonical scheduling fields
            region: scheduling.region,
            deliveryDateTime: scheduling.deliveryDateTime,
            deliveryDateSource: scheduling.deliveryDateSource,
            needsSchedulingReview: scheduling.needsSchedulingReview,
          }
        });

        try {
          await parseAndUpsertCompanyForOrder({
            shopifyOrder: order as any,
            transformedOrder: transformed as any,
          });
        } catch (companyError) {
          console.error('⚠️ [order-sync] Company parse failed:', companyError);
        }

        if (scheduling.needsSchedulingReview) {
          needsReviewCount += 1;
          needsReviewOrderNumbers.push(parseInt(transformed.orderNumber, 10));
        }

        return { ok: true };
      } catch (err) {
        console.error('❌ [order-sync] Failed to create order:', err);
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

  console.log(`🎉 [order-sync] Complete: synced=${synced}, skipped=${skipped}, errors=${errors}`);
  return {
    synced,
    skipped,
    errors,
    needsReviewCount,
    needsReviewOrderNumbers,
    total: shopifyOrders.length,
  };
}
