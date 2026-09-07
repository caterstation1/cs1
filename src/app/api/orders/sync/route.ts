import { NextResponse } from 'next/server';
import { syncShopifyOrders } from '@/lib/order-sync';

// Back-compat endpoint used by Orders UI. Delegates to Prisma/Railway sync (not Firestore).
export async function POST() {
  try {
    console.log('🔄 [orders/sync] Starting Shopify orders sync…');
    const result = await syncShopifyOrders();
    return NextResponse.json({
      message: 'Orders synced to PostgreSQL.',
      result: {
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors,
        needsReviewCount: result.needsReviewCount,
        needsReviewOrderNumbers: result.needsReviewOrderNumbers,
      },
      total: result.total,
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
