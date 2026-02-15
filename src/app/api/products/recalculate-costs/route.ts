import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Function to calculate total cost from ingredients
const calculateTotalCost = (ingredients: any[]): number => {
  if (!Array.isArray(ingredients)) return 0;
  return ingredients.reduce((total, ingredient) => {
    const quantity = Number(ingredient?.quantity || 0);
    const cost = Number(ingredient?.cost || 0);
    return total + (isFinite(quantity) && isFinite(cost) ? quantity * cost : 0);
  }, 0);
};

// Function to get current ingredient cost from database
const getCurrentIngredientCost = async (source: string, id: string): Promise<number> => {
  try {
    switch (source) {
      case 'Bidfood':
        const bidfoodItem = await prisma.bidfoodProduct.findUnique({
          where: { id }
        });
        return bidfoodItem?.lastPricePaid || 0;
        
      case 'Gilmours':
        const gilmoursItem = await prisma.gilmoursProduct.findUnique({
          where: { id }
        });
        return gilmoursItem?.price || 0;
        
      case 'Other':
        const otherItem = await prisma.otherProduct.findUnique({
          where: { id }
        });
        return otherItem?.cost || 0;
        
      case 'Components':
        const component = await prisma.component.findUnique({
          where: { id }
        });
        // Use per-output-unit cost when available for unit-based usage
        if (component && typeof (component as any).costPerOutputUnit === 'number' && (component as any).costPerOutputUnit > 0) {
          return (component as any).costPerOutputUnit as number;
        }
        return component?.totalCost || 0;
        
      case 'Products':
        const product = await prisma.productVariant.findUnique({
          where: { variantId: id }
        });
        return product?.totalCost || 0;
        
      default:
        return 0;
    }
  } catch (error) {
    console.error(`Error getting cost for ${source} item ${id}:`, error);
    return 0;
  }
};

// Function to update ingredient costs in a product's ingredients array
const updateIngredientCosts = async (ingredients: any[]): Promise<any[]> => {
  if (!Array.isArray(ingredients)) return [];
  const updatedIngredients = await Promise.all(
    ingredients.map(async (ingredient) => {
      const currentCost = await getCurrentIngredientCost(String(ingredient?.source || ''), String(ingredient?.id || ''));
      return { ...ingredient, cost: currentCost };
    })
  );
  return updatedIngredients;
};

export async function POST(request: Request) {
  try {
    console.log('🔄 Starting product cost recalculation...');
    
    // Optional filters
    let filter: any = undefined
    try {
      const body = await request.json().catch(() => ({}))
      const variantId = body?.variantId ? String(body.variantId) : null
      const productId = body?.productId ? String(body.productId) : null
      if (variantId) filter = { where: { variantId } }
      else if (productId) filter = { where: { productId } }
    } catch {}

    // Get variants along with their parent product baseIngredients
    const products = await prisma.productVariant.findMany({
      ...(filter || {}),
      include: {
        product: { select: { baseIngredients: true } }
      }
    });
    
    console.log(`📦 Found ${products.length} products with ingredients to recalculate`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each product
    for (const product of products) {
      try {
        const variantIngredients = Array.isArray(product.ingredients) ? product.ingredients as any[] : [];
        const baseIngredients = Array.isArray((product as any).product?.baseIngredients) ? ((product as any).product?.baseIngredients as any[]) : [];
        // Combine base + variant for costing
        const combined = [...baseIngredients, ...variantIngredients];
        const updatedCombined = await updateIngredientCosts(combined);
        // Calculate new total cost from combined
        const newTotalCost = calculateTotalCost(updatedCombined);
        
        // Update the product
        await prisma.productVariant.update({
          where: { id: product.id },
          data: {
            // Keep variant-specific ingredients as-is; totalCost reflects base+variant
            totalCost: newTotalCost
          }
        });
        
        console.log(`✅ Updated product ${product.shopifyName}: $${product.totalCost} → $${newTotalCost}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating product ${product.shopifyName}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ Cost recalculation complete: ${updatedCount} updated, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Recalculated costs for ${updatedCount} products`,
      updated: updatedCount,
      errors: errorCount
    });
    
  } catch (error) {
    console.error('❌ Error in cost recalculation:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate product costs' },
      { status: 500 }
    );
  }
}
