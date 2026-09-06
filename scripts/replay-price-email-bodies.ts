// Re-reads the body samples stored on recent EmailIngestion rows with the
// current parsers, without touching the database or Resend.
//
// This is the loop for fixing a parser: a supplier changes their layout, the
// summary email shows rows going missing, and this shows exactly what the
// parser now makes of the body that produced it. Add `--body` to print the
// stored text itself when a parser returns nothing and the layout has to be
// read by eye.
//
//   npx tsx scripts/replay-price-email-bodies.ts [--body] [--take=20]

import { prisma } from '../src/lib/prisma'
import { parseBidfoodInvoiceText, parseGilmoursOrderText, parseProduceCoOrderText } from '../src/lib/pricing/ingest/parse'
import { deriveUnitPricing } from '../src/lib/pricing/packsize'

const showBody = process.argv.includes('--body')
const takeArg = process.argv.find((a) => a.startsWith('--take='))
const take = takeArg ? Number(takeArg.split('=')[1]) : 20

async function main() {
  const rows = await prisma.emailIngestion.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: { createdAt: true, supplier: true, status: true, parser: true, subject: true, report: true },
  })

  for (const r of rows) {
    const report = (r.report ?? {}) as { bodySample?: string }
    if (!report.bodySample) continue

    const supplier = String(r.supplier ?? '')
    const outcome =
      supplier === 'Produce Company'
        ? parseProduceCoOrderText(report.bodySample)
        : supplier === 'Bidfood'
          ? parseBidfoodInvoiceText(report.bodySample)
          : parseGilmoursOrderText(report.bodySample)

    console.log(`\n===== ${r.createdAt.toISOString().slice(0, 16)} | ${supplier} | was ${r.status} (${r.parser ?? 'no parser'}) =====`)
    console.log(r.subject ?? '(no subject)')

    if (!outcome) {
      console.log('  no rows')
    } else {
      console.log(`  ${outcome.parser} → ${outcome.rows.length} rows`)
      for (const row of outcome.rows) {
        const pricing = deriveUnitPricing({
          packSize: row.packSize,
          uom: row.uom,
          ctnQty: row.ctnQty,
          price: row.price,
        })
        console.log(
          `    ${String(row.sku).padEnd(10)} ${String(row.description || '(no name)').padEnd(48)} ` +
            `pack=${row.packSize ?? '-'} uom=${row.uom ?? '-'} $${row.price} → ` +
            (pricing
              ? `$${pricing.unitCost.toFixed(4)}/${pricing.unit} (${pricing.basis}, conf ${pricing.confidence})`
              : 'no unit cost')
        )
      }
    }

    if (showBody) console.log(`\n--- body ---\n${report.bodySample}\n`)
  }
}

main().finally(() => prisma.$disconnect())
