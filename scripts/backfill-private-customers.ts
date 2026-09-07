import { prisma, withRetry } from '../src/lib/prisma'
import { extractEmailRootDomain, isGenericEmailDomain } from '../src/lib/company-matching'

const PRIVATE_COMPANY_NAME = 'Private Customer'

function getCompanyField(address: unknown): string {
  if (!address || typeof address !== 'object') return ''
  const value = (address as Record<string, unknown>).company
  return typeof value === 'string' ? value.trim() : ''
}

function emailCustomerId(email?: string | null): string | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  return normalized ? `email:${normalized}` : null
}

async function refreshCompanyTotals(companyId: string) {
  const [aggregate, minMax] = await Promise.all([
    prisma.companyOrder.aggregate({
      where: { companyId },
      _count: { _all: true },
      _sum: { orderTotal: true },
    }),
    prisma.companyOrder.aggregate({
      where: { companyId },
      _min: { orderDate: true },
      _max: { orderDate: true },
    }),
  ])
  await prisma.company.update({
    where: { companyId },
    data: {
      totalOrders: aggregate._count._all || 0,
      totalRevenue: aggregate._sum.orderTotal || 0,
      firstOrderDate: minMax._min.orderDate || null,
      lastOrderDate: minMax._max.orderDate || null,
    },
  })
}

async function ensurePrivateCompany() {
  const existing = await prisma.company.findFirst({
    where: { canonicalCompanyName: PRIVATE_COMPANY_NAME },
    select: { companyId: true },
  })
  if (existing) return existing.companyId
  const created = await prisma.company.create({
    data: {
      canonicalCompanyName: PRIVATE_COMPANY_NAME,
      companyNameVariants: [PRIVATE_COMPANY_NAME, 'Private'],
      confidenceScore: 100,
    },
    select: { companyId: true },
  })
  return created.companyId
}

async function run() {
  const batchSize = Number(process.env.BATCH_SIZE || '200')
  const maxRows = Number(process.env.MAX_ROWS || '0')
  const privateCompanyId = await ensurePrivateCompany()

  const totalInDb = await prisma.order.count({
    where: {
      source: 'shopify',
    },
  })
  const total = maxRows > 0 ? Math.min(maxRows, totalInDb) : totalInDb
  console.log(`[private-backfill] Starting generic-email private pass for ${total} orders`)

  let processed = 0
  let classifiedPrivate = 0
  let skipped = 0
  let failed = 0
  let skipOffset = 0

  const impactedCompanyIds = new Set<string>()
  impactedCompanyIds.add(privateCompanyId)

  while (processed < total) {
    const take = Math.min(batchSize, total - processed)
    const rows = await prisma.order.findMany({
      where: {
        source: 'shopify',
      },
      orderBy: { createdAt: 'asc' },
      skip: skipOffset,
      take,
    })
    if (!rows.length) break

    for (const row of rows) {
      try {
        if (!row.customerEmail) {
          skipped += 1
          continue
        }
        const domain = extractEmailRootDomain(row.customerEmail)
        const isGeneric = isGenericEmailDomain(domain)
        const shippingCompany = getCompanyField(row.shippingAddress)
        const billingCompany = getCompanyField(row.billingAddress)
        const hasCompanyName = Boolean(shippingCompany || billingCompany)

        if (!isGeneric || hasCompanyName) {
          skipped += 1
          continue
        }

        const existingOrder = await withRetry(() =>
          prisma.companyOrder.findUnique({
            where: { shopifyOrderId: row.shopifyId },
            select: { companyId: true },
          })
        )
        if (existingOrder?.companyId && existingOrder.companyId !== privateCompanyId) {
          impactedCompanyIds.add(existingOrder.companyId)
        }

        await withRetry(() =>
          prisma.companyOrder.upsert({
            where: { shopifyOrderId: row.shopifyId },
            create: {
              companyId: privateCompanyId,
              shopifyOrderId: row.shopifyId,
              shopifyCustomerId: emailCustomerId(row.customerEmail),
              orderDate: row.createdAt,
              orderTotal: Number(row.totalPrice || 0),
              orderSubtotal: Number(row.subtotalPrice || 0),
              discounts: 0,
              refunds: 0,
              products: row.lineItems as any,
              deliveryAddress: row.shippingAddress as any,
              billingAddress: row.billingAddress as any,
              sourceChannel: row.source || null,
              matchMethod: 'MANUAL_OVERRIDE',
              confidenceScore: 100,
              matchReason: `Private customer auto-classification (${domain || 'unknown domain'})`,
            },
            update: {
              companyId: privateCompanyId,
              shopifyCustomerId: emailCustomerId(row.customerEmail),
              orderDate: row.createdAt,
              orderTotal: Number(row.totalPrice || 0),
              orderSubtotal: Number(row.subtotalPrice || 0),
              products: row.lineItems as any,
              deliveryAddress: row.shippingAddress as any,
              billingAddress: row.billingAddress as any,
              sourceChannel: row.source || null,
              matchMethod: 'MANUAL_OVERRIDE',
              confidenceScore: 100,
              matchReason: `Private customer auto-classification (${domain || 'unknown domain'})`,
            },
          })
        )

        if (row.customerEmail) {
          await withRetry(() =>
            prisma.companyContact.upsert({
              where: {
                companyId_email: {
                  companyId: privateCompanyId,
                  email: row.customerEmail.trim().toLowerCase(),
                },
              },
              create: {
                companyId: privateCompanyId,
                shopifyCustomerId: emailCustomerId(row.customerEmail),
                firstName: row.customerFirstName || null,
                lastName: row.customerLastName || null,
                email: row.customerEmail.trim().toLowerCase(),
                phone: row.customerPhone || null,
                firstOrderDate: row.createdAt,
                lastOrderDate: row.createdAt,
              },
              update: {
                firstName: row.customerFirstName || null,
                lastName: row.customerLastName || null,
                phone: row.customerPhone || null,
                lastOrderDate: row.createdAt,
              },
            })
          )
        }

        classifiedPrivate += 1
      } catch (error) {
        failed += 1
        console.error(`[private-backfill] Failed for ${row.shopifyId}:`, error)
      } finally {
        processed += 1
      }
    }

    skipOffset += rows.length
    console.log(
      `[private-backfill] Processed ${processed}/${total} | private=${classifiedPrivate} | skipped=${skipped} | failed=${failed}`
    )
  }

  for (const companyId of impactedCompanyIds) {
    await withRetry(() => refreshCompanyTotals(companyId))
  }

  console.log(
    `[private-backfill] Completed. Processed=${processed} Private=${classifiedPrivate} Skipped=${skipped} Failed=${failed}`
  )
}

run()
  .catch((error) => {
    console.error('[private-backfill] Fatal error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
