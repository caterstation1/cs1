const { PrismaClient } = require('@prisma/client');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

const prisma = new PrismaClient();

// Initialize Firebase
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function migrateData() {
  try {
    console.log('🚀 Starting data migration to Firestore...');
    
    // Migrate products
    const products = await prisma.productWithCustomData.findMany();
    console.log(`📦 Migrating ${products.length} products...`);
    
    for (const product of products) {
      const { id, ...productData } = product;
      await db.collection('products').doc(product.variantId).set({
        ...productData,
        firestoreId: product.variantId,
      });
    }
    console.log('✅ Products migrated successfully!');
    
    // Migrate orders
    const orders = await prisma.order.findMany();
    console.log(`📋 Migrating ${orders.length} orders...`);
    
    for (const order of orders) {
      await db.collection('orders').doc(order.id).set(order);
    }
    console.log('✅ Orders migrated successfully!');
    
    // Migrate rules
    const rules = await prisma.productRule.findMany();
    console.log(`⚙️ Migrating ${rules.length} rules...`);
    
    for (const rule of rules) {
      await db.collection('rules').doc(rule.id).set(rule);
    }
    console.log('✅ Rules migrated successfully!');
    
    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Products: ${products.length}`);
    console.log(`   - Orders: ${orders.length}`);
    console.log(`   - Rules: ${rules.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run migration
migrateData(); 