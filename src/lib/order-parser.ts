import { prisma } from './prisma';
import { ShopifyOrder as ShopifyClientOrder } from './shopify-client';
import { formatLocalDate, parseLocalDate } from './date-utils';

// Use the interface from shopify-client
type ShopifyOrder = ShopifyClientOrder;

export async function parseShopifyOrder(shopifyOrder: ShopifyOrder) {
  try {
    console.log('🔄 Parsing Shopify order:', shopifyOrder.id);
    
    const { deliveryTime, deliveryDate } = extractDeliveryInfo(
      shopifyOrder.note_attributes,
      shopifyOrder.note || undefined,
      shopifyOrder.tags
    );

    // Transform line items to match our expected format
    const transformedLineItems = shopifyOrder.line_items.map((item: any) => ({
      id: item.id?.toString() || item.sku,
      variant_id: item.variant_id,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      variant_title: item.variant_title,
      vendor: item.vendor || 'Cater Station',
      product_id: item.id // We'll need this for product lookup
    }));

    const parsedOrder = {
      id: shopifyOrder.id.toString(),
      orderNumber: shopifyOrder.order_number.toString(),
      name: `#${shopifyOrder.order_number}`, // Generate name from order number
      customerFirstName: shopifyOrder.customer.first_name,
      customerLastName: shopifyOrder.customer.last_name,
      customerCompany: shopifyOrder.shipping_address?.company,
      customerPhone: shopifyOrder.customer.phone,
      customerEmail: shopifyOrder.customer.email,
      shippingAddress: {
        address1: shopifyOrder.shipping_address?.address1,
        address2: shopifyOrder.shipping_address?.address2,
        city: shopifyOrder.shipping_address?.city,
        province: shopifyOrder.shipping_address?.province,
        zip: shopifyOrder.shipping_address?.zip,
        country: shopifyOrder.shipping_address?.country,
        company: shopifyOrder.shipping_address?.company,
        phone: shopifyOrder.shipping_address?.phone
      },
      deliveryTime,
      deliveryDate: deliveryDate?.toISOString().split('T')[0],
      lineItems: transformedLineItems,
      createdAt: shopifyOrder.created_at,
      updatedAt: shopifyOrder.updated_at,
      processedAt: shopifyOrder.processed_at,
      tags: shopifyOrder.tags,
      note: shopifyOrder.note,
      financialStatus: shopifyOrder.financial_status,
      fulfillmentStatus: shopifyOrder.fulfillment_status,
      totalPrice: parseFloat(shopifyOrder.total_price),
      subtotalPrice: parseFloat(shopifyOrder.subtotal_price),
      totalTax: parseFloat(shopifyOrder.total_tax),
      currency: shopifyOrder.currency,
      // Add flags for tracking
      hasLocalEdits: false,
      isDispatched: false,
      // Add timestamps for sync tracking
      syncedAt: new Date().toISOString(),
      shopifyId: shopifyOrder.id
    };

    console.log('✅ Parsed order:', {
      id: parsedOrder.id,
      orderNumber: parsedOrder.orderNumber,
      customerName: `${parsedOrder.customerFirstName} ${parsedOrder.customerLastName}`,
      deliveryTime: parsedOrder.deliveryTime,
      deliveryDate: parsedOrder.deliveryDate,
      lineItemsCount: parsedOrder.lineItems.length
    });

    return parsedOrder;
  } catch (error) {
    console.error('❌ Error parsing Shopify order:', error);
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

  console.log('🔍 Extracting delivery info:', { note_attributes, note, tags });

  // 1. Try note_attributes
  if (note_attributes && Array.isArray(note_attributes)) {
    for (const attr of note_attributes) {
      if (attr.name.toLowerCase().includes('delivery date') && attr.value) {
        // Fix: Parse date in local time to avoid timezone issues
        deliveryDate = parseLocalDate(attr.value);
        if (deliveryDate) {
          console.log('📅 Found delivery date in note_attributes:', attr.value);
        }
      }
      if (attr.name.toLowerCase().includes('delivery time') && attr.value) {
        deliveryTime = parseFirstTimeTo24Hour(attr.value);
        console.log('⏰ Found delivery time in note_attributes:', attr.value, '->', deliveryTime);
      }
    }
  }

  // 2. Try note string
  if ((!deliveryDate || !deliveryTime) && note) {
    // Example: "Delivery Date: Wed May 7 2025 | Delivery Time: 12:00 PM - 12:15 PM"
    const dateMatch = note.match(/Delivery Date: ([^|]+)/i);
    const timeMatch = note.match(/Delivery Time: ([^|]+)/i);
    if (!deliveryDate && dateMatch && dateMatch[1]) {
      // Fix: Parse date in local time to avoid timezone issues
      deliveryDate = parseLocalDate(dateMatch[1].trim());
      if (deliveryDate) {
        console.log('📅 Found delivery date in note:', dateMatch[1].trim());
      }
    }
    if (!deliveryTime && timeMatch && timeMatch[1]) {
      deliveryTime = parseFirstTimeTo24Hour(timeMatch[1].trim());
      console.log('⏰ Found delivery time in note:', timeMatch[1].trim(), '->', deliveryTime);
    }
  }

  // 3. Try tags (legacy fallback)
  if ((!deliveryDate || !deliveryTime) && tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    for (const tag of tagArray) {
      if (!deliveryTime && tag.includes('delivery_time:')) {
        deliveryTime = parseFirstTimeTo24Hour(tag.replace('delivery_time:', '').trim());
        console.log('⏰ Found delivery time in tags:', tag, '->', deliveryTime);
      }
      if (!deliveryDate && tag.includes('delivery_date:')) {
        const dateStr = tag.replace('delivery_date:', '').trim();
        // Fix: Parse date in local time to avoid timezone issues
        deliveryDate = parseLocalDate(dateStr);
        if (deliveryDate) {
          console.log('📅 Found delivery date in tags:', dateStr);
        }
      }
    }
  }

  // 4. Fallback: if still not found, use current date in local time
  if (!deliveryDate) {
    // Fix: Create date in local time to avoid timezone issues
    deliveryDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0);
    console.log('📅 Using fallback delivery date:', deliveryDate);
  }

  console.log('✅ Final delivery info:', { deliveryTime, deliveryDate });
  return { deliveryTime, deliveryDate };
}

export async function updateParsedOrder(orderId: string, updates: any) {
  try {
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updates
    });
    return updatedOrder;
  } catch (error) {
    console.error('Error updating parsed order:', error);
    throw error;
  }
} 