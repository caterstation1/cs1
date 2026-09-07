// Paid, non-cancelled line quantities rolled up to ShopifyProduct.id.
// Used by the Products tab "list by most sold" sort.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

function toQty(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    const n = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{ variant_id: string | null; qty: unknown }>>`
      SELECT
        COALESCE(NULLIF(li->>'variant_id', ''), NULLIF(li->>'variantId', '')) AS variant_id,
        SUM(COALESCE(NULLIF(li->>'quantity', '')::numeric, 0)) AS qty
      FROM "Order" o
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(o."lineItems") = 'array' THEN o."lineItems"
          ELSE '[]'::jsonb
        END
      ) AS li
      WHERE o."cancelledAt" IS NULL
        AND LOWER(COALESCE(o."financialStatus", '')) IN ('paid', 'partially_paid')
      GROUP BY 1
    `

    const qtyByVariant = new Map<string, number>()
    for (const row of rows) {
      const id = String(row.variant_id || '').trim()
      if (!id) continue
      qtyByVariant.set(id, (qtyByVariant.get(id) || 0) + toQty(row.qty))
    }

    const variantIds = [...qtyByVariant.keys()]
    const byProductId: Record<string, number> = {}
    const chunk = 1000
    for (let i = 0; i < variantIds.length; i += chunk) {
      const slice = variantIds.slice(i, i + chunk)
      const variants = await prisma.productVariant.findMany({
        where: { variantId: { in: slice } },
        select: { variantId: true, productId: true },
      })
      for (const variant of variants) {
        const qty = qtyByVariant.get(variant.variantId) || 0
        if (!qty) continue
        byProductId[variant.productId] = (byProductId[variant.productId] || 0) + qty
      }
    }

    return NextResponse.json({ byProductId })
  } catch (error) {
    console.error('❌ /api/products/sales failed:', error)
    return NextResponse.json({ error: 'Failed to load product sales' }, { status: 500 })
  }
}
