import { createAdminApiClient } from '@shopify/admin-api-client';

export interface ShopifyOrder {
  id: string;
  order_number: number;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  cancelled_at: string | null;
  closed_at: string | null;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  tags: string;
  note: string | null;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
  shipping_address: {
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    company: string | null;
    name: string;
    phone: string | null;
  } | null;
  shipping_lines: Array<{
    id: string;
    phone: string | null;
    title: string;
    price: string;
  }>;
  billing_address: any;
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
    sku: string | null;
    variant_id: number;
  }>;
  note_attributes: Array<{
    name: string;
    value: string;
  }>;
}

// Initialize the Shopify client
export const shopifyClient = (() => {
  const storeDomain = process.env.SHOPIFY_SHOP_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  console.log('Shopify Environment Variables:', {
    storeDomain,
    accessToken: accessToken ? '***' : undefined
  });

  if (!storeDomain || !accessToken) {
    console.error('Missing Shopify environment variables. Please check your .env file.');
    return null;
  }

  try {
    const client = createAdminApiClient({
      storeDomain,
      accessToken,
      apiVersion: '2024-10'
    });
    console.log('Shopify client initialized successfully');
    return client;
  } catch (error) {
    console.error('Error initializing Shopify client:', error);
    return null;
  }
})();

// NOTE: The old `syncShopifyOrders` implementation that lived here (and called
// `prisma.$disconnect()` on the shared singleton in its `finally` block) has
// been removed. The live order sync is `syncShopifyOrders` in
// `src/lib/order-sync.ts`.
