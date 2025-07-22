import { Product } from '@/types/product';
import { prisma } from './prisma';

interface ShopifyOrder {
  id: string;
  order_number: string;
  customer: {
    first_name: string;
    last_name: string;
    company?: string;
    phone?: string;
  };
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
  };
  line_items: Array<{
    sku: string;
    title: string;
    quantity: number;
    price: string;
  }>;
  note?: string;
  note_attributes?: Array<{ name: string; value: string }>;
  tags: string;
  created_at: string;
}

export async function parseShopifyOrder(shopifyOrder: ShopifyOrder) {
  try {
    // Extract delivery time and date from note_attributes, note, or tags
    const { deliveryTime, deliveryDate } = extractDeliveryInfo(shopifyOrder.note_attributes, shopifyOrder.note, shopifyOrder.tags);
    
    // Create the parsed order
    const parsedOrder = await prisma.parsedOrder.create({
      data: {
        id: shopifyOrder.id,
        shopifyOrderId: shopifyOrder.id,
        orderNumber: shopifyOrder.order_number,
        deliveryTime,
        deliveryDate,
        deliveryAddress: shopifyOrder.shipping_address,
        customerName: `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`,
        customerCompany: shopifyOrder.customer.company || null,
        customerPhone: shopifyOrder.customer.phone || '',
        orderNotes: shopifyOrder.note || null,
        lineItems: {
          create: await Promise.all(shopifyOrder.line_items.map(async (item) => {
            // Fetch product details from our database
            const product = await prisma.product.findFirst({
              where: { 
                OR: [
                  { variantSku: item.sku },
                  { skuSearch: item.sku }
                ]
              }
            });

            return {
              id: `${shopifyOrder.id}-${item.sku}`,
              sku: item.sku,
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              handle: product?.handle || null,
              meat1: product?.meat1 || null,
              meat2: product?.meat2 || null,
              serveware: product?.serveware || null,
              option1: product?.option1 || null,
              option2: product?.option2 || null,
            };
          }))
        }
      },
      include: {
        lineItems: true
      }
    });

    return parsedOrder;
  } catch (error) {
    console.error('Error parsing Shopify order:', error);
    throw error;
  }
}

// Utility to parse first time in a range and convert to 24-hour HH:mm
function parseFirstTimeTo24Hour(timeRange: string): string {
  if (!timeRange) return '';
  // Take the first part before '-' or '–'
  const firstPart = timeRange.split(/[–-]/)[0].trim();
  // Match 12-hour time
  const match = firstPart.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  // If already in 24-hour format
  if (/^\d{2}:\d{2}$/.test(firstPart)) return firstPart;
  return '';
}

function extractDeliveryInfo(note_attributes?: Array<{ name: string; value: string }>, note?: string, tags?: string) {
  let deliveryTime = '';
  let deliveryDate: Date | null = null;

  // 1. Try note_attributes
  if (note_attributes && Array.isArray(note_attributes)) {
    for (const attr of note_attributes) {
      if (attr.name.toLowerCase().includes('delivery date') && attr.value) {
        const parsed = new Date(attr.value);
        if (!isNaN(parsed.getTime())) deliveryDate = parsed;
      }
      if (attr.name.toLowerCase().includes('delivery time') && attr.value) {
        deliveryTime = parseFirstTimeTo24Hour(attr.value);
      }
    }
  }

  // 2. Try note string
  if ((!deliveryDate || !deliveryTime) && note) {
    // Example: "Delivery Date: Wed May 7 2025 | Delivery Time: 12:00 PM - 12:15 PM"
    const dateMatch = note.match(/Delivery Date: ([^|]+)/i);
    const timeMatch = note.match(/Delivery Time: ([^|]+)/i);
    if (!deliveryDate && dateMatch && dateMatch[1]) {
      const parsed = new Date(dateMatch[1].trim());
      if (!isNaN(parsed.getTime())) deliveryDate = parsed;
    }
    if (!deliveryTime && timeMatch && timeMatch[1]) {
      deliveryTime = parseFirstTimeTo24Hour(timeMatch[1].trim());
    }
  }

  // 3. Try tags (legacy fallback)
  if ((!deliveryDate || !deliveryTime) && tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    for (const tag of tagArray) {
      if (!deliveryTime && tag.includes('delivery_time:')) {
        deliveryTime = parseFirstTimeTo24Hour(tag.replace('delivery_time:', '').trim());
      }
      if (!deliveryDate && tag.includes('delivery_date:')) {
        const dateStr = tag.replace('delivery_date:', '').trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) deliveryDate = parsed;
      }
    }
  }

  // 4. Fallback: if still not found, use current date
  if (!deliveryDate) deliveryDate = new Date();

  return { deliveryTime, deliveryDate };
}

export async function updateParsedOrder(orderId: string, updates: any) {
  try {
    const updatedOrder = await prisma.parsedOrder.update({
      where: { id: orderId },
      data: updates,
      include: {
        lineItems: true
      }
    });
    return updatedOrder;
  } catch (error) {
    console.error('Error updating parsed order:', error);
    throw error;
  }
} 