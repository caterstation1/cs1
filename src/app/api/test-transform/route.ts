import { NextResponse } from 'next/server';
import { transformShopifyOrder } from '@/lib/data-transformer';

export async function POST() {
  try {
    console.log('🧪 Testing data transformation...');
    
    // Create a sample Shopify order for testing
    const sampleShopifyOrder = {
      id: 123456789,
      order_number: 9999,
      created_at: "2025-07-25T10:00:00Z",
      updated_at: "2025-07-25T10:00:00Z",
      processed_at: "2025-07-25T10:00:00Z",
      cancelled_at: null,
      closed_at: null,
      total_price: "100.00",
      subtotal_price: "87.00",
      total_tax: "13.00",
      currency: "NZD",
      financial_status: "paid",
      fulfillment_status: null,
      tags: "test, delivery_time:14:30, delivery_date:2025-07-26",
      note: "Delivery Date: Sat Jul 26 2025 | Delivery Time: 2:30 PM - 3:00 PM",
      note_attributes: [
        { name: "Delivery Date", value: "July 26, 2025" },
        { name: "Delivery Time", value: "2:30 PM - 3:00 PM" }
      ],
      customer: {
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: "+64123456789"
      },
      shipping_address: {
        address1: "123 Test Street",
        address2: "Apt 4B",
        city: "Auckland",
        province: "Auckland",
        zip: "1010",
        country: "New Zealand",
        company: "Test Company",
        phone: "+64123456789"
      },
      billing_address: {
        address1: "123 Test Street",
        city: "Auckland",
        country: "New Zealand"
      },
      line_items: [
        {
          id: 987654321,
          variant_id: 12345,
          sku: "TEST-SKU-1",
          title: "Test Product",
          quantity: 2,
          price: "43.50",
          variant_title: "Large",
          vendor: "Cater Station"
        }
      ]
    };
    
    console.log('🔄 Transforming sample order...');
    const transformedOrder = transformShopifyOrder(sampleShopifyOrder);
    
    console.log('✅ Transformation successful:', {
      id: transformedOrder.id,
      customerName: `${transformedOrder.customerFirstName} ${transformedOrder.customerLastName}`,
      phone: transformedOrder.customerPhone,
      deliveryTime: transformedOrder.deliveryTime,
      deliveryDate: transformedOrder.deliveryDate
    });
    
    return NextResponse.json({
      success: true,
      original: sampleShopifyOrder,
      transformed: transformedOrder
    });
    
  } catch (error) {
    console.error('❌ Transformation test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 