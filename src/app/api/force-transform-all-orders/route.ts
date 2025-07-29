import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transformShopifyOrder } from '@/lib/data-transformer';
import { fetchShopifyOrders } from '@/lib/shopify-client';

export async function POST() {
  try {
    console.log('🔄 Force transforming all orders from Shopify...');
    
    // Fetch all orders from Shopify
    const shopifyOrders = await fetchShopifyOrders();
    console.log(`📦 Fetched ${shopifyOrders.length} orders from Shopify`);
    
    let transformed = 0;
    let errors = 0;
    
    for (const shopifyOrder of shopifyOrders) {
      try {
        console.log(`🔄 Processing order ${shopifyOrder.id}...`);
        
        // Transform the order
        const transformedOrder = transformShopifyOrder(shopifyOrder);
        
        // Check if order already exists
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyId: shopifyOrder.id.toString() }
        });
        
        if (existingOrder) {
          console.log(`⏭️ Order ${shopifyOrder.id} already exists, updating...`);
          await prisma.order.update({
            where: { shopifyId: shopifyOrder.id.toString() },
            data: {
              orderNumber: parseInt(transformedOrder.orderNumber),
              customerFirstName: transformedOrder.customerFirstName,
              customerLastName: transformedOrder.customerLastName,
              customerEmail: transformedOrder.customerEmail,
              customerPhone: transformedOrder.customerPhone,
              deliveryTime: transformedOrder.deliveryTime,
              deliveryDate: transformedOrder.deliveryDate,
              totalPrice: transformedOrder.totalPrice,
              subtotalPrice: transformedOrder.subtotalPrice,
              totalTax: transformedOrder.totalTax,
              currency: transformedOrder.currency,
              financialStatus: transformedOrder.financialStatus,
              fulfillmentStatus: transformedOrder.fulfillmentStatus,
              lineItems: transformedOrder.lineItems,
              shippingAddress: transformedOrder.shippingAddress,
              tags: transformedOrder.tags,
              note: transformedOrder.notes,
              syncedAt: new Date()
            }
          });
        } else {
          console.log(`✅ Creating new order ${shopifyOrder.id}...`);
          await prisma.order.create({
            data: {
              shopifyId: shopifyOrder.id.toString(),
              orderNumber: parseInt(transformedOrder.orderNumber),
              createdAt: new Date(),
              updatedAt: new Date(),
              totalPrice: transformedOrder.totalPrice,
              subtotalPrice: transformedOrder.subtotalPrice,
              totalTax: transformedOrder.totalTax,
              currency: transformedOrder.currency,
              financialStatus: transformedOrder.financialStatus,
              fulfillmentStatus: transformedOrder.fulfillmentStatus,
              customerEmail: transformedOrder.customerEmail,
              customerFirstName: transformedOrder.customerFirstName,
              customerLastName: transformedOrder.customerLastName,
              customerPhone: transformedOrder.customerPhone,
              shippingAddress: transformedOrder.shippingAddress,
              lineItems: transformedOrder.lineItems,
              source: 'shopify',
              hasLocalEdits: false,
              deliveryDate: transformedOrder.deliveryDate,
              deliveryTime: transformedOrder.deliveryTime,
              tags: transformedOrder.tags,
              note: transformedOrder.notes,
              isDispatched: false,
              syncedAt: new Date()
            }
          });
        }
        
        transformed++;
        console.log(`✅ Transformed order: ${transformedOrder.customerFirstName} ${transformedOrder.customerLastName}`);
        
      } catch (error) {
        errors++;
        console.error(`❌ Error transforming order ${shopifyOrder.id}:`, error);
      }
    }
    
    console.log(`🎉 Force transform completed: ${transformed} transformed, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: 'Force transform completed',
      transformed,
      errors,
      total: shopifyOrders.length
    });
    
  } catch (error) {
    console.error('❌ Error in force transform:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to force transform orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 