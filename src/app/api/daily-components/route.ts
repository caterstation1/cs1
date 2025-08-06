import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ComponentRequirement {
  id: string
  name: string
  quantity: number
  unit: string
  totalCost: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    if (!dateParam) {
      return NextResponse.json({
        message: 'Date parameter is required',
        components: [],
        totalOrders: 0,
        totalProducts: 0,
        summary: {
          totalComponents: 0,
          totalQuantity: 0,
          totalCost: 0
        }
      });
    }

    console.log('🧩 Fetching daily components for date:', dateParam);
    
    // Parse the date and create date range for the entire day
    const targetDate = new Date(dateParam);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('📅 Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());

    // Fetch orders for the specific date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: dateParam // deliveryDate is a string in YYYY-MM-DD format
      }
    });

    console.log(`📋 Found ${orders.length} orders for date ${dateParam}`);

    // Extract all product IDs from orders
    const productIds = new Set<string>();
    orders.forEach(order => {
      if (order.lineItems && Array.isArray(order.lineItems)) {
        order.lineItems.forEach((item: any) => {
          if (item && item.sku) {
            // We'll use SKU to find products instead of productId
            productIds.add(item.sku);
          }
        });
      }
    });

    console.log(`🛍️ Found ${productIds.size} unique products in orders`);

    // Fetch products with custom data (which contain ingredients)
    const productsWithIngredients = await prisma.productWithCustomData.findMany({
      where: {
        shopifySku: {
          in: Array.from(productIds)
        }
      }
    });

    console.log(`🧀 Found ${productsWithIngredients.length} products with ingredients`);

    // Aggregate ingredients from all products
    const ingredientCounts = new Map<string, { quantity: number, cost: number, unit: string }>();

    productsWithIngredients.forEach(product => {
      if (product.ingredients && Array.isArray(product.ingredients)) {
        product.ingredients.forEach((ingredient: any) => {
          if (ingredient && ingredient.name) {
            const key = ingredient.name.toLowerCase().trim();
            const current = ingredientCounts.get(key) || { quantity: 0, cost: 0, unit: ingredient.unit || 'units' };
            
            current.quantity += ingredient.quantity || 1;
            current.cost += ingredient.cost || 0;
            
            ingredientCounts.set(key, current);
          }
        });
      }
    });

    console.log(`📊 Aggregated ${ingredientCounts.size} unique ingredients`);

    // Convert to component requirements format
    const componentRequirements: ComponentRequirement[] = Array.from(ingredientCounts.entries()).map(([name, data], index) => ({
      id: `component-${index}`,
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
      quantity: Math.ceil(data.quantity), // Round up to whole numbers
      unit: data.unit,
      totalCost: data.cost
    }));

    // Calculate summary
    const summary = {
      totalComponents: componentRequirements.length,
      totalQuantity: componentRequirements.reduce((sum, comp) => sum + comp.quantity, 0),
      totalCost: componentRequirements.reduce((sum, comp) => sum + comp.totalCost, 0)
    };

    console.log(`✅ Daily components calculated: ${componentRequirements.length} components, ${summary.totalQuantity} total quantity, $${summary.totalCost.toFixed(2)} total cost`);

    return NextResponse.json({
      message: 'Fetched daily components from PostgreSQL.',
      components: componentRequirements,
      totalOrders: orders.length,
      totalProducts: productIds.size,
      summary
    });
  } catch (error) {
    console.error('❌ Error fetching daily components:', error);
    
    // Return empty array instead of error
    return NextResponse.json({
      message: 'Error fetching daily components',
      error: error instanceof Error ? error.message : 'Unknown error',
      components: [],
      totalOrders: 0,
      totalProducts: 0,
      summary: {
        totalComponents: 0,
        totalQuantity: 0,
        totalCost: 0
      }
    }, { status: 200 }); // Return 200 with empty data instead of 500
  }
} 