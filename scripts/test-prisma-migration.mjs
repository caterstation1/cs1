#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🧪 Testing Prisma Migration...\n');

// Test database connection
async function testDatabaseConnection() {
  try {
    const { prisma } = await import('../src/lib/prisma.ts');
    
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test basic queries
    console.log('\n📊 Testing basic queries...');
    
    const staffCount = await prisma.staff.count();
    console.log(`👥 Staff count: ${staffCount}`);
    
    const ordersCount = await prisma.order.count();
    console.log(`📦 Orders count: ${ordersCount}`);
    
    const productsCount = await prisma.product.count();
    console.log(`🛍️ Products count: ${productsCount}`);
    
    const suppliersCount = await prisma.supplier.count();
    console.log(`🏢 Suppliers count: ${suppliersCount}`);
    
    const componentsCount = await prisma.component.count();
    console.log(`🧩 Components count: ${componentsCount}`);
    
    await prisma.$disconnect();
    console.log('\n✅ All tests passed! Prisma migration successful.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection();