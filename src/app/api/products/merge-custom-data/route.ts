import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ingredient = { source: string; id?: string; name?: string; quantity: number; cost?: number }

function sig(ing: Ingredient): string {
  const src = (ing.source || '').toString().trim()
  const id = (ing.id || '').toString().trim()
  const name = (ing.name || '').toString().trim().toLowerCase()
  const qty = Number(ing.quantity || 0)
  return `${src}|${id}|${name}|${qty}`
}

function arr(ings: any): Ingredient[] {
  return Array.isArray(ings) ? ings.map((i:any) => ({
    source: String(i?.source || ''),
    id: i?.id != null ? String(i.id) : undefined,
    name: i?.name != null ? String(i.name) : undefined,
    quantity: Number(i?.quantity || 0),
    cost: i?.cost != null ? Number(i.cost) : undefined
  })) : []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = Boolean(body?.dryRun ?? true)
    const limit = Number(body?.limit ?? 200)
    const productFilterId = body?.productId ? String(body.productId) : null
    const variantFilterId = body?.variantId ? String(body.variantId) : null

    // Load products with variants; optionally filter
    const products = await prisma.shopifyProduct.findMany({
      where: productFilterId ? { id: productFilterId } : undefined,
      include: {
        variants: {
          where: variantFilterId ? { variantId: variantFilterId } : undefined
        }
      },
      take: limit
    })

    const results: any[] = []
    let updatedProducts = 0
    let updatedVariants = 0

    for (const p of products) {
      if (!Array.isArray(p.variants) || p.variants.length === 0) continue

      // For each variant, prefer live variant.ingredients; fallback to legacy ProductWithCustomData
      const variantData = []
      for (const v of p.variants as any[]) {
        let vIngs = arr(v.ingredients)
        if (vIngs.length === 0) {
          const legacy = await prisma.productWithCustomData.findUnique({ where: { variantId: v.variantId } })
          if (legacy?.ingredients) vIngs = arr(legacy.ingredients)
        }
        variantData.push({ variant: v, ingredients: vIngs })
      }

      if (variantData.length === 0) continue

      // Build signature sets per variant
      const sigSets = variantData.map(vd => new Set(vd.ingredients.map(sig)))

      // Common signatures present in ALL variants
      const common = new Set<string>(sigSets[0])
      for (let i = 1; i < sigSets.length; i++) {
        for (const k of Array.from(common)) {
          if (!sigSets[i].has(k)) common.delete(k)
        }
      }

      // Base ingredients are those common entries; reconstruct Ingredient objects from first variant matching sig
      const firstMap = new Map(variantData[0].ingredients.map(ing => [sig(ing), ing]))
      const baseIngredients: Ingredient[] = Array.from(common).map(k => firstMap.get(k)).filter(Boolean) as Ingredient[]

      // Compute residual per variant (ingredients minus base signatures)
      const updates: Array<{ id: string; residual: Ingredient[] }> = []
      for (const vd of variantData) {
        const residual = vd.ingredients.filter(ing => !common.has(sig(ing)))
        updates.push({ id: vd.variant.id, residual })
      }

      // Persist or report
      if (!dryRun) {
        // Update product baseIngredients
        await prisma.shopifyProduct.update({
          where: { id: p.id },
          data: { baseIngredients: baseIngredients as any }
        })
        updatedProducts++

        // Update variants residual ingredients only (totalCost will be recalculated separately)
        for (const u of updates) {
          await prisma.productVariant.update({
            where: { id: u.id },
            data: { ingredients: u.residual as any }
          })
          updatedVariants++
        }
      }

      results.push({
        productId: p.id,
        productTitle: p.productTitle,
        variantCount: p.variants.length,
        baseIngredientsCount: baseIngredients.length,
        sampleBase: baseIngredients.slice(0, 5),
      })
    }

    return NextResponse.json({
      dryRun,
      productsProcessed: products.length,
      updatedProducts,
      updatedVariants,
      results
    })
  } catch (e) {
    console.error('❌ Merge custom data error:', e)
    return NextResponse.json({ error: 'Failed to merge custom data' }, { status: 500 })
  }
}

