#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const wlgOrderNumbers = [10479, 10483, 10517, 10536, 10557, 10574, 10581, 10595, 10599, 10600, 10609, 10639];

async function verifyWLGOrders() {
  try {
    console.log('🔍 Verifying Wellington orders...\n');
    console.log('Expected WLG Orders:', wlgOrderNumbers);
    console.log('Total Expected:', wlgOrderNumbers.length);
    console.log('\n========================================\n');
    
    const results = [];
    
    for (const orderNum of wlgOrderNumbers) {
      const order = await prisma.order.findFirst({
        where: { orderNumber: orderNum }
      });
      
      if (!order) {
        console.log(`❌ Order ${orderNum}: NOT FOUND IN DATABASE`);
        results.push({ orderNum, status: 'NOT_FOUND', reason: 'Missing from database' });
        continue;
      }
      
      // Check if order should be in WLG calendar based on the filter logic
      let shouldBeInWLG = false;
      let matchReason = '';
      
      // 1) Check note_attributes City
      const noteAttributes = order.noteAttributes;
      if (noteAttributes && Array.isArray(noteAttributes)) {
        const cityAttr = noteAttributes.find(attr => attr.name?.toLowerCase() === 'city');
        if (cityAttr && String(cityAttr.value).toUpperCase() === 'WLG') {
          shouldBeInWLG = true;
          matchReason = 'note_attributes City=WLG';
        }
      }
      
      // 2) Check line items properties (legacy)
      if (!shouldBeInWLG) {
        const lineItems = order.lineItems;
        if (lineItems && Array.isArray(lineItems)) {
          const hasWLGProperty = lineItems.some(item => 
            Array.isArray(item.properties) && 
            item.properties.some(prop => 
              prop.name?.toLowerCase() === 'city' && 
              String(prop.value).toUpperCase() === 'WLG'
            )
          );
          if (hasWLGProperty) {
            shouldBeInWLG = true;
            matchReason = 'line_items properties City=WLG';
          }
        }
      }
      
      // 3) Check shipping address
      if (!shouldBeInWLG) {
        const ship = order.shippingAddress || {};
        const shipCity = String(ship.city || '').toLowerCase();
        const shipProvince = String(ship.province || '').toLowerCase();
        const provinceCode = String(ship.province_code || '').toUpperCase();
        
        if (shipCity.includes('wellington') || shipProvince === 'wellington' || provinceCode === 'WGN') {
          shouldBeInWLG = true;
          matchReason = `shipping_address (city="${ship.city}", province="${ship.province}")`;
        }
      }
      
      // Extract city from note_attributes for display
      let cityInNoteAttrs = 'N/A';
      if (noteAttributes && Array.isArray(noteAttributes)) {
        const cityAttr = noteAttributes.find(attr => attr.name?.toLowerCase() === 'city');
        cityInNoteAttrs = cityAttr?.value || 'N/A';
      }
      
      const ship = order.shippingAddress || {};
      
      if (shouldBeInWLG) {
        console.log(`✅ Order ${orderNum}: WILL SHOW IN WLG`);
        console.log(`   Match Reason: ${matchReason}`);
        console.log(`   City in note_attributes: ${cityInNoteAttrs}`);
        console.log(`   Shipping: ${ship.city || 'N/A'}, ${ship.province || 'N/A'}`);
        results.push({ orderNum, status: 'MATCH', reason: matchReason });
      } else {
        console.log(`❌ Order ${orderNum}: WILL NOT SHOW IN WLG`);
        console.log(`   City in note_attributes: ${cityInNoteAttrs}`);
        console.log(`   Shipping: ${ship.city || 'N/A'}, ${ship.province || 'N/A'}`);
        console.log(`   ⚠️  MISSING WELLINGTON INDICATORS`);
        results.push({ orderNum, status: 'NO_MATCH', cityInNoteAttrs, shipping: `${ship.city}, ${ship.province}` });
      }
      console.log('');
    }
    
    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================\n');
    
    const matched = results.filter(r => r.status === 'MATCH');
    const notMatched = results.filter(r => r.status === 'NO_MATCH');
    const notFound = results.filter(r => r.status === 'NOT_FOUND');
    
    console.log(`✅ Will show in WLG: ${matched.length}`);
    console.log(`❌ Will NOT show in WLG: ${notMatched.length}`);
    console.log(`❌ Not found in DB: ${notFound.length}`);
    console.log(`📋 Total checked: ${wlgOrderNumbers.length}`);
    
    if (notMatched.length > 0) {
      console.log('\n⚠️  ORDERS THAT NEED FIXING:');
      notMatched.forEach(r => {
        console.log(`   - Order ${r.orderNum}: City=${r.cityInNoteAttrs}, Shipping=${r.shipping}`);
      });
    }
    
    if (notFound.length > 0) {
      console.log('\n❌ ORDERS NOT IN DATABASE:');
      notFound.forEach(r => {
        console.log(`   - Order ${r.orderNum}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyWLGOrders();



