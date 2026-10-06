// Fills Order.noteAttributes from Shopify for orders that were synced without it.
//
// The column has existed since the initial migration, but neither sync path
// wrote to it — both read the raw note_attributes only to work out the delivery
// date, then dropped them. So every order synced before that was fixed has
// noteAttributes = null, and anything carried on a cart attribute is invisible
// to the app. The thank-you note upload is the first feature that needs one.
//
// The syncs now persist note attributes on create, so this is only needed for
// orders already in the database.
//
// Usage:
//   npx tsx scripts/backfill-order-note-attributes.ts                (dry run, no writes)
//   npx tsx scripts/backfill-order-note-attributes.ts --apply        (write)
//   npx tsx scripts/backfill-order-note-attributes.ts --days=30      (how far back to look, default 14)
//   npx tsx scripts/backfill-order-note-attributes.ts --order=13711  (a single order number)

import { config } from 'dotenv'
import { Prisma } from '../src/generated/prisma'
import { prisma } from '../src/lib/prisma'

config({ path: '.env' })
config({ path: '.env.local', override: false })

const APPLY = process.argv.includes('--apply')
const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.slice('--days='.length) || 14)
const ONLY_ORDER = Number(process.argv.find((a) => a.startsWith('--order='))?.slice('--order='.length) || 0)

const SHOP = process.env.SHOPIFY_SHOP_URL
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10'

async function fetchNoteAttributes(shopifyId: string) {
  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/orders/${shopifyId}.json?fields=id,order_number,note_attributes`,
    { headers: { 'X-Shopify-Access-Token': TOKEN as string } }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Shopify ${res.status} for order ${shopifyId}`)
  const body = await res.json()
  return (body?.order?.note_attributes ?? []) as Array<{ name: string; value: string }>
}

async function main() {
  if (!SHOP || !TOKEN) throw new Error('SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN must be set')

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
  const orders = await prisma.order.findMany({
    where: ONLY_ORDER
      ? { orderNumber: ONLY_ORDER }
      : { source: 'shopify', noteAttributes: { equals: Prisma.DbNull }, createdAt: { gte: since } },
    select: { id: true, orderNumber: true, shopifyId: true, noteAttributes: true },
    orderBy: { orderNumber: 'asc' },
  })

  console.log(
    `${orders.length} order(s) to check` +
      (ONLY_ORDER ? ` (order ${ONLY_ORDER})` : ` (synced from Shopify in the last ${DAYS} days, no note attributes)`)
  )

  let filled = 0
  let empty = 0
  let missing = 0

  for (const order of orders) {
    if (!order.shopifyId) {
      missing++
      continue
    }

    const attributes = await fetchNoteAttributes(order.shopifyId)
    if (attributes === null) {
      console.log(`  #${order.orderNumber}: not found on Shopify`)
      missing++
      continue
    }
    if (attributes.length === 0) {
      empty++
      continue
    }

    const names = attributes.map((a) => a.name).join(', ')
    console.log(`  #${order.orderNumber}: ${attributes.length} attribute(s) — ${names}`)

    if (APPLY) {
      await prisma.order.update({
        where: { id: order.id },
        data: { noteAttributes: attributes as any },
      })
    }
    filled++

    // Stay well inside Shopify's 2 calls/second REST limit.
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(
    `\n${APPLY ? 'Updated' : 'Would update'} ${filled} order(s). ` +
      `${empty} had no attributes on Shopify, ${missing} could not be read.`
  )
  if (!APPLY && filled > 0) console.log('Re-run with --apply to write.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
