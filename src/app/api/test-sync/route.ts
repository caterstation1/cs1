import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🔄 Manually triggering Shopify sync...');
    
    // Call the Shopify sync endpoint
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/shopify/sync-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Shopify sync failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Shopify sync completed:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Shopify sync triggered successfully',
      result
    });
    
  } catch (error) {
    console.error('❌ Error triggering Shopify sync:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger Shopify sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 