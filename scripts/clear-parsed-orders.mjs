import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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