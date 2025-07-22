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

  const data = await response.json()
  return data.orders
}
