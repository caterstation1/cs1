import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🚀 Starting data initialization...');
    
    // Step 1: Sync Shopify products to PostgreSQL
    console.log('📦 Step 1: Syncing Shopify products...');
    const shopifyProductsResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/shopify/products`, {
      method: 'POST'
    });
    
    if (!shopifyProductsResponse.ok) {
      console.error('❌ Failed to sync Shopify products:', shopifyProductsResponse.status, shopifyProductsResponse.statusText);
      throw new Error(`Failed to sync Shopify products: ${shopifyProductsResponse.status} ${shopifyProductsResponse.statusText}`);
    }
    
    const shopifyProductsResult = await shopifyProductsResponse.json();
    console.log('✅ Shopify products synced:', shopifyProductsResult);
    
    // Step 2: Sync Shopify orders to PostgreSQL
    console.log('📋 Step 2: Syncing Shopify orders...');
    const shopifyOrdersResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/shopify/sync-orders`, {
      method: 'POST'
    });
    
    if (!shopifyOrdersResponse.ok) {
      console.error('❌ Failed to sync Shopify orders:', shopifyOrdersResponse.status, shopifyOrdersResponse.statusText);
      throw new Error(`Failed to sync Shopify orders: ${shopifyOrdersResponse.status} ${shopifyOrdersResponse.statusText}`);
    }
    
    const shopifyOrdersResult = await shopifyOrdersResponse.json();
    console.log('✅ Shopify orders synced:', shopifyOrdersResult);
    
    // Step 3: Sync products with custom data
    console.log('🔧 Step 3: Syncing products with custom data...');
    const customDataResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/products-with-custom-data/sync`, {
      method: 'POST'
    });
    
    if (!customDataResponse.ok) {
      console.warn('⚠️ Failed to sync custom data (this is expected if no custom data exists yet)');
    } else {
      const customDataResult = await customDataResponse.json();
      console.log('✅ Custom data synced:', customDataResult);
    }
    
    // Step 4: Apply product rules to populate custom data
    console.log('⚙️ Step 4: Applying product rules...');
    const rulesResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/product-rules/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply-all' })
    });
    
    if (!rulesResponse.ok) {
      console.warn('⚠️ Failed to apply rules (this is expected if no rules exist yet)');
    } else {
      const rulesResult = await rulesResponse.json();
      console.log('✅ Rules applied:', rulesResult);
    }
    
    // Step 5: Get summary of what was initialized
    const products = await prisma.product.findMany();
    
    console.log('🎉 Data initialization completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Data initialization completed successfully',
      summary: {
        shopifyProducts: shopifyProductsResult.synced || 0,
        shopifyOrders: shopifyOrdersResult.synced || 0,
        totalProductsInPostgreSQL: products.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Data initialization failed:', error);
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize data',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 