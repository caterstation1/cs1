#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function fixWellingtonOrders() {
  try {
    console.log('🔧 Fixing missing data for Wellington orders 10599, 10600...\n');
    
    const orderNumbers = [10599, 10600];
    
    for (const orderNum of orderNumbers) {
      console.log(`\n========================================`);
      console.log(`Processing order ${orderNum}...`);
      console.log(`========================================\n`);
      
      // Find the order
      const order = await prisma.order.findFirst({
        where: { orderNumber: orderNum }
      });
      
      if (!order) {
        console.log(`❌ Order ${orderNum} not found in database`);
        continue;
      }
      
      console.log(`✅ Found order: ${order.orderNumber} (ID: ${order.id})`);
      console.log('📊 Current data:');
      console.log(`  - Phone: ${order.customerPhone || 'null'}`);
      console.log(`  - Note Attributes: ${order.noteAttributes || 'null'}`);
      console.log(`  - Delivery Instructions: ${order.deliveryInstructions || 'null'}`);
      console.log(`  - Shipping Address City: ${order.shippingAddress?.city || 'null'}`);
      console.log(`  - Shipping Address Province: ${order.shippingAddress?.province || 'null'}`);
      
      // Get Shopify credentials from environment
      const shopUrl = process.env.SHOPIFY_SHOP_URL;
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const apiVersion = process.env.SHOPIFY_API_VERSION;
      
      if (!shopUrl || !accessToken || !apiVersion) {
        console.log('❌ Shopify credentials not found in environment');
        continue;
      }
      
      const url = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`;
      
      console.log('\n🔄 Fetching fresh data from Shopify...');
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log(`❌ Shopify API error: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      const shopifyOrder = data.order;
      
      // Extract the missing data
      const noteAttributes = shopifyOrder.note_attributes || [];
      const deliveryInstructions = shopifyOrder.shipping_address?.delivery_instructions || null;
      const phoneFromShipping = shopifyOrder.shipping_lines?.[0]?.phone || null;
      
      console.log('\n📋 Shopify data found:');
      console.log(`  - Note Attributes: ${noteAttributes.length} items`);
      if (noteAttributes.length > 0) {
        noteAttributes.forEach(attr => {
          console.log(`    - ${attr.name}: ${attr.value}`);
        });
      }
      console.log(`  - Delivery Instructions: ${deliveryInstructions || 'null'}`);
      console.log(`  - Phone from Shipping: ${phoneFromShipping || 'null'}`);
      console.log(`  - Shipping City: ${shopifyOrder.shipping_address?.city || 'null'}`);
      console.log(`  - Shipping Province: ${shopifyOrder.shipping_address?.province || 'null'}`);
      console.log(`  - Shipping Province Code: ${shopifyOrder.shipping_address?.province_code || 'null'}`);
      
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
        console.log('\n🔄 Updating order with missing data...');
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: updateData
        });
        
        console.log('✅ Order updated successfully!');
        console.log('📊 Changes made:', changes);
        console.log('📊 Updated data:');
        console.log(`  - Phone: ${updatedOrder.customerPhone || 'null'}`);
        console.log(`  - Note Attributes: ${updatedOrder.noteAttributes ? 'Updated (' + JSON.stringify(updatedOrder.noteAttributes).substring(0, 100) + '...)' : 'null'}`);
        console.log(`  - Delivery Instructions: ${updatedOrder.deliveryInstructions || 'null'}`);
        
      } else {
        console.log('\nℹ️  No missing data found - order is already up to date');
      }
    }
    
    console.log('\n\n========================================');
    console.log('🎉 Fix completed for all orders!');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ Error in fix script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixWellingtonOrders();
