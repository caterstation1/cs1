import { NextResponse } from 'next/server';
import { fetchShopifyOrders } from '../../../../lib/shopify-client';
import { orderAdapter } from '../../../../lib/firestore-adapters';

export async function POST() {
  try {
    // 1. Fetch orders from Shopify
    const shopifyOrders = await fetchShopifyOrders();
    let synced = 0;
    let errors = 0;
    for (const order of shopifyOrders) {
      try {
        // Use Shopify order ID as Firestore doc ID if possible, else just add
        await orderAdapter.create({ ...order, shopifyId: order.id });
        synced++;
      } catch (err) {
        errors++;
        // Optionally log error details
        console.error('Error syncing order', order.id, err);
      }
    }
    return NextResponse.json({
      message: `Orders synced to Firestore.`,
      synced,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error syncing orders',
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 