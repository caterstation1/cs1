import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessLevel } from '@/lib/authz';

export async function GET() {
  try {
    const role = await getAccessLevel()
    if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.log('📦 Fetching products with custom data from PostgreSQL...');

    const products = await prisma.productWithCustomData.findMany({
      orderBy: {
        shopifyName: 'asc'
      }
    });

    // Helper to get current cost for an ingredient by source/id
    const getCurrentIngredientCost = async (source: string, id: string): Promise<number> => {
      try {
        switch (source) {
          case 'Bidfood': {
            const item = await prisma.bidfoodProduct.findUnique({ where: { id } })
            return item?.lastPricePaid || 0
          }
          case 'Gilmours': {
            const item = await prisma.gilmoursProduct.findUnique({ where: { id } })
            return item?.price || 0
          }
          case 'Other': {
            const item = await prisma.otherProduct.findUnique({ where: { id } })
            return item?.cost || 0
          }
          case 'Components': {
            const comp = await prisma.component.findUnique({ where: { id } })
            const cpu = (comp as any)?.costPerOutputUnit
            if (typeof cpu === 'number' && cpu > 0) return cpu
            return comp?.totalCost || 0
          }
          case 'Products': {
            const prod = await prisma.productWithCustomData.findUnique({ where: { variantId: id } })
            return prod?.totalCost || 0
          }
          default:
            return 0
        }
      } catch {
        return 0
      }
    }

    // Compute a fresh total cost using current ingredient prices
    const withComputedTotals = await Promise.all(products.map(async (p) => {
      const ingredients = (p as any).ingredients as any[] | null
      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return p
      }
      const rows = await Promise.all(ingredients.map(async (ing) => {
        const quantity = Number(ing?.quantity || 0)
        const cost = await getCurrentIngredientCost(String(ing?.source || ''), String(ing?.id || ''))
        return quantity * (isFinite(cost) ? cost : 0)
      }))
      const computedTotal = rows.reduce((a, b) => a + b, 0)
      return { ...p, totalCost: computedTotal }
    }))

    console.log(`✅ Successfully fetched ${products.length} products with computed totals`);
    return NextResponse.json(withComputedTotals);
  } catch (error) {
    console.error('❌ Error fetching products with custom data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products with custom data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const role = await getAccessLevel()
    if (!role || (role !== 'admin' && role !== 'owner' && role !== 'basic')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json();
    
    const product = await prisma.productWithCustomData.create({
      data: {
        variantId: body.variantId,
        shopifyProductId: body.shopifyProductId,
        shopifySku: body.shopifySku,
        shopifyName: body.shopifyName,
        shopifyTitle: body.shopifyTitle,
        shopifyPrice: body.shopifyPrice,
        shopifyInventory: body.shopifyInventory,
        displayName: body.displayName,
        meat1: body.meat1,
        meat2: body.meat2,
        timer1: body.timer1,
        timer2: body.timer2,
        option1: body.option1,
        option2: body.option2,
        serveware: body.serveware || false,
        isDraft: body.isDraft || false,
        ingredients: body.ingredients,
        totalCost: body.totalCost || 0
      }
    });
    
    console.log(`✅ Created product with custom data: ${product.shopifyName}`);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product with custom data:', error);
    return NextResponse.json(
      { error: 'Failed to create product with custom data' },
      { status: 500 }
    );
  }
} 