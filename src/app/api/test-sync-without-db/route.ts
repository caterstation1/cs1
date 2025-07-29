import { NextResponse } from 'next/server';
import { transformShopifyOrder } from '@/lib/data-transformer';
import { ShopifyOrder } from '@/lib/shopify-client';

export async function GET() {
  try {
    console.log('🧪 Testing sync without database...');
    
    // Mock Shopify order data
    const mockShopifyOrder: ShopifyOrder = {
      id: 123456789,
      order_number: 1001,
      created_at: '2025-07-28T10:00:00Z',
      updated_at: '2025-07-28T10:00:00Z',
      processed_at: null,
      cancelled_at: null,
      closed_at: null,
      total_price: '150.00',
      subtotal_price: '150.00',
      total_tax: '0.00',
      currency: 'NZD',
      financial_status: 'paid',
      fulfillment_status: 'unfulfilled',
      tags: 'test-order',
      note: 'Test order for sync',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+64212345678'
      },
      shipping_address: {
        address1: '123 Test St',
        city: 'Auckland',
        zip: '1010',
        country: 'New Zealand'
      },
      billing_address: null,
      line_items: [
        {
          id: 1,
          variant_id: 123,
          sku: 'TEST-001',
          title: 'Test Product',
          quantity: 2,
          price: '75.00',
          product_id: 456
        }
      ],
      note_attributes: []
    };
    
    // Transform the order
    const transformedOrder = transformShopifyOrder(mockShopifyOrder);
    
    console.log(`✅ Transformed order:`, {
      id: transformedOrder.id,
      customerFirstName: transformedOrder.customerFirstName,
      customerLastName: transformedOrder.customerLastName,
      phone: transformedOrder.customerPhone,
      deliveryTime: transformedOrder.deliveryTime,
      deliveryDate: transformedOrder.deliveryDate,
      lineItemsCount: transformedOrder.lineItems.length
    });
    
    return NextResponse.json({
      success: true,
      message: 'Sync test completed without database',
      transformedOrder: {
        id: transformedOrder.id,
        customerFirstName: transformedOrder.customerFirstName,
        customerLastName: transformedOrder.customerLastName,
        customerEmail: transformedOrder.customerEmail,
        customerPhone: transformedOrder.customerPhone,
        deliveryTime: transformedOrder.deliveryTime,
        deliveryDate: transformedOrder.deliveryDate,
        totalPrice: transformedOrder.totalPrice,
        currency: transformedOrder.currency,
        financialStatus: transformedOrder.financialStatus,
        fulfillmentStatus: transformedOrder.fulfillmentStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing sync without database:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test sync without database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 