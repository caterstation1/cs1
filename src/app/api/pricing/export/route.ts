// CSV export of every sellable product with its live pricing picture:
// cost, retail price, margin, and the suggested (target-margin) price.
// Same engine pass as /api/pricing/catalog — nothing is recomputed differently.

import { NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { CostResult, costVariant, marginFor } from '@/lib/pricing/cost'
import { buildCostIndex } from '@/lib/pricing/resolve'

export const maxDuration = 300

const csvField = (v: string | number | null | undefined): string => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const money = (v: number | null) => (v == null ? '' : v.toFixed(2))
const percent = (v: number | null) => (v == null ? '' : (v * 100).toFixed(1))

export async function GET() {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const index = await buildCostIndex()
    const cache = new Map<string, CostResult>()
    const { targetMargin, gstRate } = index.settings

    const header = [
      'Product',
      'SKU',
      'Cost',
      'Lines costed %',
      'RRP incl GST',
      'RRP ex GST',
      'Gross profit $ (ex GST)',
      'Margin %',
      `Target margin %`,
      'Suggested RRP ex GST',
      'Suggested RRP incl GST',
      'Below target',
    ]

    const rows: string[] = [header.join(',')]

    const variants = [...index.variantsByVariantId.values()].sort((a, b) => a.name.localeCompare(b.name))
    for (const variant of variants) {
      const result = costVariant(variant.variantId, index, { cache })
      const m = marginFor(result.total, variant.shopifyPriceInclGst, gstRate, targetMargin)
      const profit = result.total != null ? m.rrpEx - result.total : null
      rows.push(
        [
          csvField(variant.name),
          csvField(variant.sku),
          money(result.total),
          percent(result.coverage.pct),
          money(m.rrpInclGst),
          money(m.rrpEx),
          money(profit),
          percent(m.margin),
          percent(targetMargin),
          money(m.targetRrpEx),
          money(m.targetRrpInclGst),
          m.margin == null ? '' : m.margin < targetMargin ? 'YES' : 'no',
        ].join(',')
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="product-pricing-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('❌ /api/pricing/export failed:', error)
    return NextResponse.json({ error: 'Failed to export pricing CSV' }, { status: 500 })
  }
}
