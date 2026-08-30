import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { splitParts } from '@/lib/variant-part-edit'
import { aliasKey, normalizeRows } from '@/lib/costing/options'

// Pack size is the only thing that varies an option's cost between products —
// a 100-person pack uses more of the same protein than a mini station — so it
// is the only thing entered per product.

export const maxDuration = 60

export async function GET() {
  try {
    const [products, options] = await Promise.all([
      prisma.shopifyProduct.findMany({
        where: { isActive: true },
        orderBy: { productTitle: 'asc' },
        select: {
          id: true,
          productTitle: true,
          portionSize: true,
          baseIngredients: true,
          variants: { select: { shopifyName: true, shopifyPrice: true } },
          optionQuantities: { select: { optionId: true, quantity: true } },
        },
      }),
      prisma.costingOption.findMany({
        select: { id: true, name: true, kind: true, items: true, noIngredients: true, aliases: { select: { value: true } } },
      }),
    ])

    const byAlias = new Map<string, (typeof options)[number]>()
    for (const option of options) {
      byAlias.set(aliasKey(option.name), option)
      for (const alias of option.aliases) byAlias.set(aliasKey(alias.value), option)
    }

    const payload = products.map((product) => {
      const explicit = new Map(product.optionQuantities.map((q) => [q.optionId, q.quantity]))
      const offered = new Map<string, { id: string; name: string; kind: string; items: string[]; costed: boolean }>()

      for (const v of product.variants) {
        for (const part of splitParts(v.shopifyName)) {
          const option = byAlias.get(aliasKey(part))
          if (!option || option.noIngredients) continue
          if (!offered.has(option.id)) {
            const items = normalizeRows(option.items)
            offered.set(option.id, {
              id: option.id,
              name: option.name,
              kind: option.kind,
              items: items.map((i) => i.name),
              costed: items.length > 0,
            })
          }
        }
      }

      const prices = product.variants
        .map((v) => Number(v.shopifyPrice ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0)

      return {
        id: product.id,
        title: product.productTitle,
        portionSize: product.portionSize,
        variantCount: product.variants.length,
        price: prices.length ? Math.max(...prices) : 0,
        baseItems: normalizeRows(product.baseIngredients).map((i) => `${i.name} ×${i.quantity}`),
        options: Array.from(offered.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((o) => ({ ...o, quantity: explicit.get(o.id) ?? null })),
      }
    })

    return NextResponse.json({ products: payload })
  } catch (e) {
    console.error('❌ costing products GET error:', e)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const productId = String(body?.productId ?? '').trim()
    if (!productId) return NextResponse.json({ error: 'productId is required' }, { status: 400 })

    if (body?.portionSize !== undefined) {
      const size = Number(body.portionSize)
      if (!Number.isFinite(size) || size < 0) {
        return NextResponse.json({ error: 'portionSize must be a positive number' }, { status: 400 })
      }
      await prisma.shopifyProduct.update({ where: { id: productId }, data: { portionSize: size } })
    }

    if (Array.isArray(body?.quantities)) {
      for (const entry of body.quantities) {
        const optionId = String(entry?.optionId ?? '').trim()
        if (!optionId) continue
        // Null clears the override so the option falls back to pack size.
        if (entry?.quantity === null || entry?.quantity === '') {
          await prisma.productOptionQuantity.deleteMany({ where: { productId, optionId } })
          continue
        }
        const quantity = Number(entry.quantity)
        if (!Number.isFinite(quantity) || quantity < 0) continue
        await prisma.productOptionQuantity.upsert({
          where: { productId_optionId: { productId, optionId } },
          create: { productId, optionId, quantity },
          update: { quantity },
        })
      }
    }

    return NextResponse.json({ saved: true })
  } catch (e) {
    console.error('❌ costing products PATCH error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
