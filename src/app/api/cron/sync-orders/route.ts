import { NextRequest, NextResponse } from 'next/server';
import { syncShopifyOrders } from '@/lib/order-sync';

// Server-side order sync so the DB stays fresh even when no one has the app open.
// Critical for the supplier-emails cron (bakery emails), which reads orders from the DB.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require it. If not set, allow (for testing/Vercel built-in)
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.log('❌ Unauthorized sync-orders cron request - CRON_SECRET required but header does not match');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log('⚠️ CRON_SECRET not set - allowing sync-orders cron request (testing mode)');
    }

    console.log('🔄 [cron/sync-orders] Starting scheduled Shopify orders sync…');
    const result = await syncShopifyOrders();

    if (result.needsReviewCount > 0) {
      console.log(`⚠️ [cron/sync-orders] ${result.needsReviewCount} new order(s) need scheduling review: ${result.needsReviewOrderNumbers.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [cron/sync-orders] Error syncing orders:', error);
    return NextResponse.json(
      { error: 'Failed to sync orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
