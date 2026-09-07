import { PrismaClient } from '@prisma/client';
import { scriptPrismaOptions } from './lib/script-prisma-url.cjs';

const prisma = new PrismaClient(scriptPrismaOptions());

async function clearParsedOrders() {
  try {
    // Delete ParsedLineItems first due to foreign key constraints
    await prisma.parsedLineItem.deleteMany();
    await prisma.parsedOrder.deleteMany();
    await prisma.shopifyOrder.deleteMany();
    console.log('All parsed orders, parsed line items, and Shopify orders deleted.');
  } catch (error) {
    console.error('Error clearing parsed orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearParsedOrders(); 