import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/env.mjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔧 Fixing missing data for order: ${id}`);
    
    // Find the order
    const order = await prisma.order.findUnique({
      where: { id }
    });
    
    if (!order) {
      return NextResponse.json({
        error: 'Order not found',
        orderId: id
      }, { status: 404 });
    }
    
    console.log(`✅ Found order: ${order.orderNumber}`);
    
    // Fetch fresh data from Shopify
    const shopUrl = env.SHOPIFY_SHOP_URL;
    const accessToken = env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = env.SHOPIFY_API_VERSION;
    
    if (!shopUrl || !accessToken || !apiVersion) {
      return NextResponse.json({
        error: 'Shopify credentials not configured'
      }, { status: 500 });
    }
    
    const url = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json({
        error: `Could not fetch Shopify data: ${response.statusText}`
      }, { status: 500 });
    }
    
    const data = await response.json();
    const shopifyOrder = data.order;
    
    // Extract the missing data
    const noteAttributes = shopifyOrder.note_attributes || [];
    const deliveryInstructions = shopifyOrder.shipping_address?.delivery_instructions || null;
    const phoneFromShipping = shopifyOrder.shipping_lines?.[0]?.phone || null;
    
    // Prepare update data
    const updateData: any = {};
    const changes: string[] = [];
    
    // Fix note attributes
    if (noteAttributes.length > 0 && (!order.noteAttributes || order.noteAttributes === '[]' || order.noteAttributes === 'null')) {
      updateData.noteAttributes = noteAttributes;
      changes.push('noteAttributes');
    }
    
    // Fix delivery instructions
    if (deliveryInstructions && !order.deliveryInstructions) {
      updateData.deliveryInstructions = deliveryInstructions;
      changes.push('deliveryInstructions');
    }
    
    // Fix phone number
    if (phoneFromShipping && !order.customerPhone) {
      updateData.customerPhone = phoneFromShipping;
      changes.push('customerPhone');
    }
    
    // Update the order if there are changes
    if (Object.keys(updateData).length > 0) {
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: updateData
      });
      
      return NextResponse.json({
        success: true,
        message: `Fixed missing data for order ${order.orderNumber}`,
        orderNumber: order.orderNumber,
        changes,
        updatedFields: updateData,
        before: {
          noteAttributes: order.noteAttributes,
          deliveryInstructions: order.deliveryInstructions,
          customerPhone: order.customerPhone
        },
        after: {
          noteAttributes: updatedOrder.noteAttributes,
          deliveryInstructions: updatedOrder.deliveryInstructions,
          customerPhone: updatedOrder.customerPhone
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `No missing data found for order ${order.orderNumber}`,
        orderNumber: order.orderNumber,
        changes: [],
        currentData: {
          noteAttributes: order.noteAttributes,
          deliveryInstructions: order.deliveryInstructions,
          customerPhone: order.customerPhone
        },
        shopifyData: {
          noteAttributes,
          deliveryInstructions,
          phoneFromShipping
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error fixing order data:', error);
    return NextResponse.json({
      error: 'Failed to fix order data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
