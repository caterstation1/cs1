import { ShopifyOrder } from './shopify-client';
import { formatLocalDate, parseLocalDate } from './date-utils';

// Business logic for data transformation
export interface TransformedOrder {
  id: string;
  orderNumber: string;
  name: string;
  customerFirstName: string;
  customerLastName: string;
  customerCompany?: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
    company?: string;
    phone?: string;
  };
  deliveryTime: string;
  deliveryDate: string;
  lineItems: Array<{
    id: string;
    variant_id: number;
    sku: string;
    title: string;
    quantity: number;
    price: number;
    variant_title?: string;
    vendor?: string;
    product_id: number;
    // Custom business fields
    cookingTime?: number;
    serveware?: boolean;
    ingredients?: Array<{
      name: string;
      quantity: number;
      unit: string;
    }>;
  }>;
  // Business logic fields
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus?: string;
  // Custom business fields
  hasLocalEdits: boolean;
  isDispatched: boolean;
  assignedStaff?: string;
  estimatedPrepTime?: number;
  actualPrepTime?: number;
  notes?: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
  shopifyId: number;
}

// Extract phone number from various sources
function extractPhoneNumber(order: ShopifyOrder): string {
  // Priority 1: Customer phone
  if (order.customer.phone) {
    return order.customer.phone;
  }
  
  // Priority 2: Shipping address phone
  if (order.shipping_address?.phone) {
    return order.shipping_address.phone;
  }
  
  // Priority 3: Extract from note
  if (order.note) {
    const phoneMatch = order.note.match(/(\+?[\d\s\-\(\)]+)/);
    if (phoneMatch) {
      return phoneMatch[1].trim();
    }
  }
  
  return '';
}

// Parse delivery information with business logic
function parseDeliveryInfo(order: ShopifyOrder): { deliveryTime: string; deliveryDate: string } {
  let deliveryTime = '';
  let deliveryDate = '';
  
  // Extract from note_attributes (most reliable)
  if (order.note_attributes) {
    for (const attr of order.note_attributes) {
      if (attr.name.toLowerCase().includes('delivery date') && attr.value) {
        // Fix: Parse date in local time to avoid timezone issues
        const localDate = parseLocalDate(attr.value);
        if (localDate) {
          deliveryDate = formatLocalDate(localDate);
        }
      }
      if (attr.name.toLowerCase().includes('delivery time') && attr.value) {
        deliveryTime = parseTimeTo24Hour(attr.value);
      }
    }
  }
  
  // Extract from note string
  if ((!deliveryDate || !deliveryTime) && order.note) {
    const dateMatch = order.note.match(/Delivery Date: ([^|]+)/i);
    const timeMatch = order.note.match(/Delivery Time: ([^|]+)/i);
    
    if (!deliveryDate && dateMatch) {
      // Fix: Parse date in local time to avoid timezone issues
      const localDate = parseLocalDate(dateMatch[1].trim());
      if (localDate) {
        deliveryDate = formatLocalDate(localDate);
      }
    }
    if (!deliveryTime && timeMatch) {
      deliveryTime = parseTimeTo24Hour(timeMatch[1].trim());
    }
  }
  
  // Extract from tags
  if ((!deliveryDate || !deliveryTime) && order.tags) {
    const tagArray = order.tags.split(',').map(tag => tag.trim());
    for (const tag of tagArray) {
      if (!deliveryTime && tag.includes('delivery_time:')) {
        deliveryTime = parseTimeTo24Hour(tag.replace('delivery_time:', '').trim());
      }
      if (!deliveryDate && tag.includes('delivery_date:')) {
        const dateStr = tag.replace('delivery_date:', '').trim();
        // Fix: Parse date in local time to avoid timezone issues
        const localDate = parseLocalDate(dateStr);
        if (localDate) {
          deliveryDate = formatLocalDate(localDate);
        }
      }
    }
  }
  
  // Fallback to current date in local time
  if (!deliveryDate) {
    deliveryDate = formatLocalDate(new Date());
  }
  
  return { deliveryTime, deliveryDate };
}

// Parse time to 24-hour format
function parseTimeTo24Hour(timeRange: string): string {
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

// Transform line items with business logic
function transformLineItems(lineItems: any[]): TransformedOrder['lineItems'] {
  return lineItems.map((item, index) => ({
    id: item.id?.toString() || `item-${index}`,
    variant_id: item.variant_id,
    sku: item.sku,
    title: item.title,
    quantity: item.quantity,
    price: parseFloat(item.price),
    variant_title: item.variant_title,
    vendor: item.vendor || 'Cater Station',
    product_id: item.id,
    // Business logic fields (will be populated by product lookup)
    cookingTime: undefined,
    serveware: undefined,
    ingredients: undefined
  }));
}

// Main transformation function
export function transformShopifyOrder(shopifyOrder: ShopifyOrder): TransformedOrder {
  console.log('🔄 Transforming Shopify order:', shopifyOrder.id);
  
  const { deliveryTime, deliveryDate } = parseDeliveryInfo(shopifyOrder);
  const customerPhone = extractPhoneNumber(shopifyOrder);
  
  const transformedOrder: TransformedOrder = {
    id: shopifyOrder.id.toString(),
    orderNumber: shopifyOrder.order_number.toString(),
    name: `#${shopifyOrder.order_number}`,
    customerFirstName: shopifyOrder.customer.first_name,
    customerLastName: shopifyOrder.customer.last_name,
    customerCompany: shopifyOrder.shipping_address?.company,
    customerPhone,
    customerEmail: shopifyOrder.customer.email,
    shippingAddress: {
      address1: shopifyOrder.shipping_address?.address1 || '',
      address2: shopifyOrder.shipping_address?.address2,
      city: shopifyOrder.shipping_address?.city || '',
      province: shopifyOrder.shipping_address?.province,
      zip: shopifyOrder.shipping_address?.zip || '',
      country: shopifyOrder.shipping_address?.country || '',
      company: shopifyOrder.shipping_address?.company,
      phone: shopifyOrder.shipping_address?.phone
    },
    deliveryTime,
    deliveryDate,
    lineItems: transformLineItems(shopifyOrder.line_items),
    totalPrice: parseFloat(shopifyOrder.total_price),
    subtotalPrice: parseFloat(shopifyOrder.subtotal_price),
    totalTax: parseFloat(shopifyOrder.total_tax),
    currency: shopifyOrder.currency,
    financialStatus: shopifyOrder.financial_status,
    fulfillmentStatus: shopifyOrder.fulfillment_status || undefined,
    hasLocalEdits: false,
    isDispatched: false,
    notes: shopifyOrder.note || undefined,
    tags: shopifyOrder.tags,
    createdAt: shopifyOrder.created_at,
    updatedAt: shopifyOrder.updated_at,
    syncedAt: new Date().toISOString(),
    shopifyId: shopifyOrder.id
  };
  
  console.log('✅ Transformed order:', {
    id: transformedOrder.id,
    customerName: `${transformedOrder.customerFirstName} ${transformedOrder.customerLastName}`,
    phone: transformedOrder.customerPhone,
    deliveryTime: transformedOrder.deliveryTime,
    deliveryDate: transformedOrder.deliveryDate,
    lineItemsCount: transformedOrder.lineItems.length
  });
  
  return transformedOrder;
} 