import { prisma } from '../src/lib/prisma'
import { withRetry } from '../src/lib/prisma'
import { domainToCompanyName, extractBusinessDomain, normalizeCompanyName } from '../src/lib/company-matching'

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function processDomainFirstOrder(row: any) {
  const domain = extractBusinessDomain(row.customerEmail)
  const shopifyOrderId = String(row.shopifyId)

  await withRetry(() =>
    prisma.rawShopifyOrder.upsert({
      where: { shopifyOrderId },
      create: {
        shopifyOrderId,
        shopifyOrderName: `#${row.orderNumber}`,
        payload: {
          id: row.shopifyId,
          name: `#${row.orderNumber}`,
          note: row.note,
          customer: {
            email: row.customerEmail,
            first_name: row.customerFirstName,
            last_name: row.customerLastName,
            phone: row.customerPhone,
          },
          shipping_address: row.shippingAddress,
          billing_address: row.billingAddress,
          source_name: row.source,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        },
      },
      update: {
        shopifyOrderName: `#${row.orderNumber}`,
        payload: {
          id: row.shopifyId,
          name: `#${row.orderNumber}`,
          note: row.note,
          customer: {
            email: row.customerEmail,
            first_name: row.customerFirstName,
            last_name: row.customerLastName,
            phone: row.customerPhone,
          },
          shipping_address: row.shippingAddress,
          billing_address: row.billingAddress,
          source_name: row.source,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        },
        fetchedAt: new Date(),
      },
    })
  )

  if (row.customerEmail) {
    const shopifyCustomerId = `email:${String(row.customerEmail).trim().toLowerCase()}`
    await withRetry(() =>
      prisma.rawShopifyCustomer.upsert({
        where: { shopifyCustomerId },
        create: {
          shopifyCustomerId,
          email: row.customerEmail,
          payload: {
            email: row.customerEmail,
            first_name: row.customerFirstName,
            last_name: row.customerLastName,
            phone: row.customerPhone,
          },
        },
        update: {
          email: row.customerEmail,
          payload: {
            email: row.customerEmail,
            first_name: row.customerFirstName,
            last_name: row.customerLastName,
            phone: row.customerPhone,
          },
          fetchedAt: new Date(),
        },
      })
    )
  }

  if (!domain) {
    return { skippedNoBusinessDomain: true }
  }

  const canonicalName = titleCase(normalizeCompanyName(domainToCompanyName(domain)) || domainToCompanyName(domain))

  const existingCompany = await withRetry(() =>
    prisma.company.findFirst({
      where: {
        OR: [{ primaryDomain: domain }, { alternateDomains: { has: domain } }],
      },
      select: { companyId: true, companyNameVariants: true, alternateDomains: true },
    })
  )
  const existingVariants = existingCompany?.companyNameVariants || []
  const existingDomains = existingCompany?.alternateDomains || []

  let companyId = existingCompany?.companyId
  if (!companyId) {
    const created = await withRetry(() =>
      prisma.company.create({
        data: {
          canonicalCompanyName: canonicalName,
          companyNameVariants: [canonicalName],
          primaryDomain: domain,
          alternateDomains: [domain],
          primaryAddress: (row.shippingAddress || row.billingAddress || null) as any,
          confidenceScore: 100,
        },
        select: { companyId: true },
      })
    )
    companyId = created.companyId
  } else {
    await withRetry(() =>
      prisma.company.update({
        where: { companyId },
        data: {
          companyNameVariants: Array.from(new Set([...existingVariants, canonicalName])),
          alternateDomains: Array.from(new Set([...existingDomains, domain])),
          primaryDomain: domain,
          confidenceScore: 100,
        },
      })
    )
  }

  await withRetry(() =>
    prisma.companyOrder.upsert({
      where: { shopifyOrderId },
      create: {
        companyId,
        shopifyOrderId,
        shopifyCustomerId: row.customerEmail ? `email:${String(row.customerEmail).trim().toLowerCase()}` : null,
        orderDate: row.createdAt,
        orderTotal: Number(row.totalPrice || 0),
        orderSubtotal: Number(row.subtotalPrice || 0),
        discounts: 0,
        refunds: 0,
        products: row.lineItems as any,
        deliveryAddress: row.shippingAddress as any,
        billingAddress: row.billingAddress as any,
        sourceChannel: row.source || null,
        matchMethod: 'DOMAIN_EXACT',
        confidenceScore: 100,
        matchReason: `Business domain exact match (${domain})`,
      },
      update: {
        companyId,
        shopifyCustomerId: row.customerEmail ? `email:${String(row.customerEmail).trim().toLowerCase()}` : null,
        orderDate: row.createdAt,
        orderTotal: Number(row.totalPrice || 0),
        orderSubtotal: Number(row.subtotalPrice || 0),
        products: row.lineItems as any,
        deliveryAddress: row.shippingAddress as any,
        billingAddress: row.billingAddress as any,
        sourceChannel: row.source || null,
        matchMethod: 'DOMAIN_EXACT',
        confidenceScore: 100,
        matchReason: `Business domain exact match (${domain})`,
      },
    })
  )

  if (row.customerEmail) {
    await withRetry(() =>
      prisma.companyContact.upsert({
        where: {
          companyId_email: {
            companyId,
            email: String(row.customerEmail).trim().toLowerCase(),
          },
        },
        create: {
          companyId,
          shopifyCustomerId: `email:${String(row.customerEmail).trim().toLowerCase()}`,
          firstName: row.customerFirstName || null,
          lastName: row.customerLastName || null,
          email: String(row.customerEmail).trim().toLowerCase(),
          phone: row.customerPhone || null,
          firstOrderDate: row.createdAt,
          lastOrderDate: row.createdAt,
          totalOrders: 0,
          totalSpend: 0,
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

  return { skippedNoBusinessDomain: false }
}

async function run() {
  const batchSize = Number(process.env.BATCH_SIZE || '100')
  const maxRows = Number(process.env.MAX_ROWS || '0')
  let skip = 0
  let processed = 0
  let failed = 0
  let domainMatched = 0
  let skippedNoBusinessDomain = 0

  const totalInDb = await prisma.order.count({ where: { source: 'shopify' } })
  const total = maxRows > 0 ? Math.min(maxRows, totalInDb) : totalInDb
  console.log(`[company-backfill] Starting DOMAIN-FIRST backfill for ${total} Shopify orders`)

  while (true) {
    if (processed >= total) break
    const take = Math.min(batchSize, total - processed)
    const rows = await prisma.order.findMany({
      where: { source: 'shopify' },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    })
    if (!rows.length) break

    for (const row of rows) {
      try {
        const result = await processDomainFirstOrder(row)
        if (result.skippedNoBusinessDomain) skippedNoBusinessDomain += 1
        else domainMatched += 1
      } catch (error) {
        failed += 1
        console.error(`[company-backfill] Failed for ${row.shopifyId}:`, error)
      } finally {
        processed += 1
      }
    }

    skip += rows.length
    console.log(
      `[company-backfill] Processed ${processed}/${total} | domainMatched=${domainMatched} | noBusinessDomain=${skippedNoBusinessDomain} | failed=${failed}`
    )
  }

  console.log(
    `[company-backfill] Completed. Processed=${processed} DomainMatched=${domainMatched} NoBusinessDomain=${skippedNoBusinessDomain} Failed=${failed}`
  )
}

run()
  .catch((error) => {
    console.error('[company-backfill] Fatal error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
