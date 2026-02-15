import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Calculate total from ingredient array using 'quantity' * 'cost'
function calcTotal(ingredients: any[]): number {
  if (!Array.isArray(ingredients)) return 0
  return Number(ingredients.reduce((t, ing) => {
    const q = Number(ing?.quantity || 0)
    const c = Number(ing?.cost || 0)
    return t + (isFinite(q) && isFinite(c) ? q * c : 0)
  }, 0).toFixed(2))
}

// Get current cost for an ingredient reference by source+id
async function getCurrentIngredientCost(source: string, id: string): Promise<number> {
  try {
    switch ((source || '').toString()) {
      case 'Bidfood': {
        const item = await prisma.bidfoodProduct.findUnique({ where: { id } })
        return Number(item?.lastPricePaid || 0)
      }
      case 'Gilmours': {
        const item = await prisma.gilmoursProduct.findUnique({ where: { id } })
        return Number(item?.price || 0)
      }
      case 'Other': {
        const item = await prisma.otherProduct.findUnique({ where: { id } })
        return Number(item?.cost || 0)
      }
      case 'Components': {
        const comp = await prisma.component.findUnique({ where: { id } })
        const perUnit = (comp && typeof (comp as any).costPerOutputUnit === 'number') ? Number((comp as any).costPerOutputUnit) : 0
        return perUnit > 0 ? perUnit : Number(comp?.totalCost || 0)
      }
      case 'Products': {
        const pv = await prisma.productVariant.findUnique({ where: { variantId: id } })
        return Number(pv?.totalCost || 0)
      }
      default:
        return 0
    }
  } catch {
    return 0
  }
}

async function repriceIngredients(ingredients: any[]): Promise<any[]> {
  if (!Array.isArray(ingredients)) return []
  const updated = await Promise.all(ingredients.map(async (ing: any) => {
    const cost = await getCurrentIngredientCost(String(ing?.source || ''), String(ing?.id || ''))
    return { ...ing, cost }
  }))
  return updated
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const variantIdParam = searchParams.get('variantId')
    const skuParam = searchParams.get('sku')

    let variant = null as any
    if (variantIdParam) {
      variant = await prisma.productVariant.findUnique({
        where: { variantId: variantIdParam },
        include: { product: { select: { baseIngredients: true, displayName: true, productTitle: true } } }
      })
    } else if (skuParam) {
      variant = await prisma.productVariant.findFirst({
        where: { shopifySku: skuParam },
        include: { product: { select: { baseIngredients: true, displayName: true, productTitle: true } } }
      })
    }
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    const legacy = await prisma.productWithCustomData.findUnique({
      where: { variantId: String(variant.variantId) },
      select: { totalCost: true, ingredients: true }
    })

    const variantIngredients = Array.isArray(variant.ingredients) ? variant.ingredients : []
    const baseIngredients = Array.isArray(variant.product?.baseIngredients) ? variant.product?.baseIngredients : []

    // Compute combined repriced cost (base + variant)
    const combined = [...baseIngredients, ...variantIngredients]
    const repriced = await repriceIngredients(combined)
    const computedCombinedTotal = calcTotal(repriced)

    return NextResponse.json({
      variantId: variant.variantId,
      sku: variant.shopifySku,
      name: variant.displayName || variant.shopifyTitle || variant.shopifyName,
      current: {
        totalCost: Number(variant.totalCost || 0),
        ingredientsCount: variantIngredients.length
      },
      legacy: {
        totalCost: Number(legacy?.totalCost || 0),
        ingredientsCount: Array.isArray(legacy?.ingredients) ? legacy?.ingredients?.length : 0
      },
      baseIngredientsCount: baseIngredients.length,
      computedCombinedTotal,
    })
  } catch (e) {
    console.error('❌ Debug variant cost error:', e)
    return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 })
  }
}

