#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { env } from '../src/env.mjs';

const prisma = new PrismaClient();

async function fixOrder10615() {
  try {
    console.log('🔧 Fixing missing data for order 10615...');
    
    // Find order 10615
    const order = await prisma.order.findFirst({
      where: { orderNumber: 10615 }
    });
    
    if (!order) {
      console.log('❌ Order 10615 not found in database');
      return;
    }
    
    console.log(`✅ Found order: ${order.orderNumber} (ID: ${order.id})`);
    console.log('📊 Current data:');
    console.log(`  - Phone: ${order.customerPhone || 'null'}`);
    console.log(`  - Note Attributes: ${order.noteAttributes || 'null'}`);
    console.log(`  - Delivery Instructions: ${order.deliveryInstructions || 'null'}`);
    
    // Fetch fresh data from Shopify
    const shopUrl = env.SHOPIFY_SHOP_URL;
    const accessToken = env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = env.SHOPIFY_API_VERSION;
    
    if (!shopUrl || !accessToken || !apiVersion) {
      throw new Error('Shopify credentials not configured');
    }
    
    const url = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`;
    
    console.log('🔄 Fetching fresh data from Shopify...');
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const shopifyOrder = data.order;
    
    // Extract the missing data
    const noteAttributes = shopifyOrder.note_attributes || [];
    const deliveryInstructions = shopifyOrder.shipping_address?.delivery_instructions || null;
    const phoneFromShipping = shopifyOrder.shipping_lines?.[0]?.phone || null;
    
    console.log('📋 Shopify data found:');
    console.log(`  - Note Attributes: ${noteAttributes.length} items`);
    if (noteAttributes.length > 0) {
      noteAttributes.forEach(attr => {
        console.log(`    - ${attr.name}: ${attr.value}`);
      });
    }
    console.log(`  - Delivery Instructions: ${deliveryInstructions || 'null'}`);
    console.log(`  - Phone from Shipping: ${phoneFromShipping || 'null'}`);
    
    // Prepare update data
    const updateData = {};
    const changes = [];
    
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
      console.log('🔄 Updating order with missing data...');
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: updateData
      });
      
      console.log('✅ Order updated successfully!');
      console.log('📊 Changes made:', changes);
      console.log('📊 Updated data:');
      console.log(`  - Phone: ${updatedOrder.customerPhone || 'null'}`);
      console.log(`  - Note Attributes: ${updatedOrder.noteAttributes ? 'Updated' : 'null'}`);
      console.log(`  - Delivery Instructions: ${updatedOrder.deliveryInstructions || 'null'}`);
      
    } else {
      console.log('ℹ️  No missing data found - order is already up to date');
    }
    
  } catch (error) {
    console.error('❌ Error fixing order 10615:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixOrder10615();
