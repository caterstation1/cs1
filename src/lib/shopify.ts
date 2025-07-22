import { prisma } from "./prisma";
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

interface ShopifyRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  data?: unknown;
}

interface ShopifyRestResponse<T> {
  data: T;
}

interface ShopifyOrdersData {
  orders: ShopifyOrder[];
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

// Create a type-safe wrapper for REST API calls
async function shopifyRestRequest<T>(options: ShopifyRequestOptions): Promise<T> {
  if (!shopifyClient) {
    throw new Error('Shopify client not initialized. Please check your environment variables.');
  }

  const response = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/${options.path}${
    options.query ? `?${new URLSearchParams(options.query).toString()}` : ''
  }`, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shopify API error response:', errorText);
    throw new Error(`Shopify REST API error: ${response.statusText}`);
  }

  return response.json();
}

function getDeliveryInfo(noteAttributes: Array<{ name: string; value: string }> | undefined) {
  if (!noteAttributes) return { deliveryDate: null, deliveryTime: null };

  const deliveryDate = noteAttributes.find(attr => attr.name === "Delivery Date")?.value || null;
  const deliveryTime = noteAttributes.find(attr => attr.name === "Delivery Time")?.value || null;

  return { deliveryDate, deliveryTime };
}

export async function syncShopifyOrders() {
  try {
    await prisma.$connect();

    const response = await shopifyRestRequest<{ orders: ShopifyOrder[] }>({
      method: 'GET',
      path: 'orders.json',
      query: {
        status: 'any',
        limit: '250'
      }
    });

    console.log('Sample order data:', JSON.stringify(response.orders[0], null, 2));

    const newOrders = response.orders.filter((order) => {
      return !order.tags?.split(',').includes('synced');
    });

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of newOrders) {
      try {
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyId: order.id.toString() }
        });

        if (existingOrder) {
          if (existingOrder.hasLocalEdits) {
            skipped++;
            continue;
          }
          skipped++;
          continue;
        }

        // Get delivery info from note_attributes
        const { deliveryDate, deliveryTime } = getDeliveryInfo(order.note_attributes);

        console.log('Processing order:', {
          id: order.id,
          orderNumber: order.order_number,
          noteAttributes: order.note_attributes,
          parsedDeliveryDate: deliveryDate,
          parsedDeliveryTime: deliveryTime,
          tags: order.tags
        });

        await prisma.order.create({
          data: {
            shopifyId: order.id.toString(),
            orderNumber: order.order_number,
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            totalPrice: parseFloat(order.total_price),
            subtotalPrice: parseFloat(order.subtotal_price),
            totalTax: parseFloat(order.total_tax),
            currency: order.currency,
            financialStatus: order.financial_status,
            fulfillmentStatus: order.fulfillment_status || null,
            tags: order.tags || null,
            note: order.note || null,
            customerFirstName: order.customer?.first_name || '',
            customerLastName: order.customer?.last_name || '',
            customerEmail: order.customer?.email || '',
            customerPhone: order.shipping_lines?.[0]?.phone || order.customer?.phone || '',
            shippingAddress: order.shipping_address ? {
              address1: order.shipping_address.address1 || '',
              address2: order.shipping_address.address2 || '',
              city: order.shipping_address.city || '',
              province: order.shipping_address.province || '',
              zip: order.shipping_address.zip || '',
              country: order.shipping_address.country || '',
              company: order.shipping_address.company || '',
              name: order.shipping_address.name || '',
              phone: order.shipping_address.phone || ''
            } : undefined,
            noteAttributes: order.note_attributes || [],  // Store the full note_attributes array
            deliveryDate,
            deliveryTime,
            leaveTime: null,
            travelTime: null,
            driverId: null,
            lineItems: order.line_items.map(item => ({
              title: item.title,
              quantity: item.quantity,
              price: parseFloat(item.price),
              sku: item.sku || '',
              variant_id: item.variant_id
            }))
          }
        });

        // Mark the order as synced in Shopify
        await shopifyRestRequest({
          method: 'PUT',
          path: `orders/${order.id}.json`,
          data: {
            order: {
              id: order.id,
              tags: order.tags ? `${order.tags},synced` : 'synced'
            }
          }
        });

        synced++;
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error);
        errors++;
      }
    }

    console.log(`✅ Finished sync: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return { synced, skipped, errors };
  } catch (error) {
    console.error('Error in syncShopifyOrders:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
