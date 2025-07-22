import { NextResponse } from 'next/server';
import { productAdapter } from '../../../lib/firestore-adapters';

// TODO: Implement Firestore adapter for Shopify products sync
export async function GET() {
  return NextResponse.json({
    message: 'Shopify products API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
}

export async function POST() {
  try {
    // Fetch products from Shopify REST API
    const shopUrl = process.env.SHOPIFY_SHOP_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2023-10';
    if (!shopUrl || !accessToken) {
      return NextResponse.json({ message: 'Missing Shopify credentials' }, { status: 500 });
    }
    const url = `https://${shopUrl}/admin/api/${apiVersion}/products.json?limit=250`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      return NextResponse.json({ message: 'Failed to fetch products from Shopify', status: response.status }, { status: 500 });
    }
    const data = await response.json();
    const products = data.products || [];
    let synced = 0;
    let errors = 0;
    for (const product of products) {
      try {
        // Use variantId as Firestore doc ID if possible
        for (const variant of product.variants || []) {
          await productAdapter.upsert({
            variantId: variant.id.toString(),
            shopifyProductId: product.id.toString(),
            shopifyName: product.title,
            shopifySku: variant.sku,
            shopifyPrice: variant.price,
            shopifyInventory: variant.inventory_quantity,
            ...variant
          });
        }
        synced++;
      } catch (err) {
        errors++;
      }
    }
    return NextResponse.json({
      message: 'Products synced to Firestore.',
      synced,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error syncing products',
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 