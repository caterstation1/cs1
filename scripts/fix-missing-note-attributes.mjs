#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { env } from '../src/env.mjs';

const prisma = new PrismaClient();

async function fixMissingNoteAttributes() {
  try {
    console.log('🔧 Starting fix for missing note attributes...');
    
    // Find orders where noteAttributes is null or empty
    const ordersWithMissingNoteAttributes = await prisma.order.findMany({
      where: {
        OR: [
          { noteAttributes: null },
          { noteAttributes: [] },
          { noteAttributes: '[]' },
          { noteAttributes: 'null' }
        ]
      },
      take: 50, // Process in batches
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 Found ${ordersWithMissingNoteAttributes.length} orders with missing note attributes`);
    
    if (ordersWithMissingNoteAttributes.length === 0) {
      console.log('✅ No orders need fixing!');
      return;
    }
    
    let fixed = 0;
    let errors = 0;
    
    for (const order of ordersWithMissingNoteAttributes) {
      try {
        console.log(`🔄 Processing order ${order.orderNumber}...`);
        
        // Fetch fresh data from Shopify
        const shopUrl = env.SHOPIFY_SHOP_URL;
        const accessToken = env.SHOPIFY_ACCESS_TOKEN;
        const apiVersion = env.SHOPIFY_API_VERSION;
        
        if (!shopUrl || !accessToken || !apiVersion) {
          throw new Error('Shopify credentials not configured');
        }
        
        const url = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`;
        
        const response = await fetch(url, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.log(`⚠️  Could not fetch Shopify data for order ${order.orderNumber}: ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        const shopifyOrder = data.order;
        
        // Extract the missing data
        const noteAttributes = shopifyOrder.note_attributes || [];
        const deliveryInstructions = shopifyOrder.shipping_address?.delivery_instructions || null;
        const phoneFromShipping = shopifyOrder.shipping_lines?.[0]?.phone || null;
        
        // Update the order with the missing data
        const updateData = {};
        
        if (noteAttributes.length > 0) {
          updateData.noteAttributes = noteAttributes;
        }
        
        if (deliveryInstructions) {
          updateData.deliveryInstructions = deliveryInstructions;
        }
        
        if (phoneFromShipping && !order.customerPhone) {
          updateData.customerPhone = phoneFromShipping;
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.order.update({
            where: { id: order.id },
            data: updateData
          });
          
          console.log(`✅ Fixed order ${order.orderNumber}:`, Object.keys(updateData));
          fixed++;
        } else {
          console.log(`ℹ️  No missing data found for order ${order.orderNumber}`);
        }
        
        // Add a small delay to be respectful to Shopify's API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing order ${order.orderNumber}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n🎉 Fix completed!`);
    console.log(`✅ Fixed: ${fixed} orders`);
    console.log(`❌ Errors: ${errors} orders`);
    console.log(`📊 Total processed: ${ordersWithMissingNoteAttributes.length} orders`);
    
  } catch (error) {
    console.error('❌ Error in fix script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixMissingNoteAttributes();
