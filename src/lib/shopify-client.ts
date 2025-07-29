import { env } from '@/env.mjs'

// Types
export interface ShopifyOrder {
  id: number
  order_number: number
  created_at: string
  updated_at: string
  processed_at: string | null
  cancelled_at: string | null
  closed_at: string | null
  total_price: string
  subtotal_price: string
  total_tax: string
  currency: string
  financial_status: string
  fulfillment_status: string | null
  tags: string
  note: string | null
  customer: {
    email: string
    first_name: string
    last_name: string
    phone: string
  }
  shipping_address: any
  billing_address: any
  line_items: any[]
  note_attributes: { name: string; value: string }[]
}

export interface ShopifyProduct {
  id: number
  product_id: number
  product_title: string  // Add the base product title
  sku: string
  title: string
  price: string
  inventory_quantity: number
  option1?: string
  option2?: string
  option3?: string
  created_at: string
  updated_at: string
}

// ✅ Extracted function
export async function fetchShopifyOrders(): Promise<ShopifyOrder[]> {
  const shopUrl = env.SHOPIFY_SHOP_URL
  const accessToken = env.SHOPIFY_ACCESS_TOKEN
  const apiVersion = env.SHOPIFY_API_VERSION

  if (!shopUrl || !accessToken || !apiVersion) {
    throw new Error('Shopify credentials not fully configured')
  }

  const url = `https://${shopUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250`

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`)
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Failed to parse Shopify response as JSON');
  }

  return data.orders || [];
}

// ✅ Fetch Shopify products
export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const shopUrl = env.SHOPIFY_SHOP_URL
  const accessToken = env.SHOPIFY_ACCESS_TOKEN
  const apiVersion = env.SHOPIFY_API_VERSION

  if (!shopUrl || !accessToken || !apiVersion) {
    throw new Error('Shopify credentials not fully configured')
  }

  const variants: ShopifyProduct[] = [];
  let hasNextPage = true;
  let nextPageInfo = null;

  while (hasNextPage) {
    const url: string = nextPageInfo 
      ? `https://${shopUrl}/admin/api/${apiVersion}/products.json?limit=50&page_info=${nextPageInfo}`
      : `https://${shopUrl}/admin/api/${apiVersion}/products.json?limit=50`;

    console.log(`📦 Fetching Shopify products page: ${nextPageInfo ? 'next' : 'first'}`);

    const response: Response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`)
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error('Failed to parse Shopify response as JSON');
    }

    // Extract variants from products
    for (const product of data.products || []) {
      for (const variant of product.variants || []) {
        variants.push({
          id: variant.id,
          product_id: product.id,
          product_title: product.title, // Add the base product title
          sku: variant.sku,
          title: variant.title,
          price: variant.price,
          inventory_quantity: variant.inventory_quantity,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          created_at: variant.created_at,
          updated_at: variant.updated_at
        });
      }
    }

    // Check for next page
    const linkHeader: string | null = response.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>; rel="next"/);
      if (nextMatch) {
        nextPageInfo = nextMatch[1];
        console.log(`📄 Found next page, continuing...`);
      } else {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }

    // Add a small delay between requests to be respectful to Shopify's API
    if (hasNextPage) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Fetched ${variants.length} product variants from Shopify`);
  return variants;
}
