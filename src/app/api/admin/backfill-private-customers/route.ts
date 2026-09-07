import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { extractEmailRootDomain, isGenericEmailDomain } from '@/lib/company-matching'

const BATCH_SIZE_DEFAULT = 300
const PRIVATE_COMPANY_NAME = 'Private Customer'

function companyFromAddress(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const company = (value as Record<string, unknown>).company
  return typeof company === 'string' ? company.trim() : ''
}

function emailCustomerId(email?: string | null): string | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  return normalized ? `email:${normalized}` : null
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

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batch = Math.max(1, Number(searchParams.get('batch') || '1'))
    const take = Math.min(1000, Math.max(50, Number(searchParams.get('take') || String(BATCH_SIZE_DEFAULT))))
    const skip = (batch - 1) * take

    const privateCompanyId = await ensurePrivateCompany()

    const [totalShopifyOrders, rows] = await Promise.all([
      prisma.order.count({ where: { source: 'shopify' } }),
      prisma.order.findMany({
        where: { source: 'shopify' },
        select: {
          shopifyId: true,
          createdAt: true,
          totalPrice: true,
          subtotalPrice: true,
          source: true,
          lineItems: true,
          shippingAddress: true,
          billingAddress: true,
          customerEmail: true,
          customerFirstName: true,
          customerLastName: true,
          customerPhone: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
    ])

    if (!rows.length) {
      return NextResponse.json({
        success: true,
        batch,
        processed: 0,
        privateAssigned: 0,
        skipped: 0,
        failed: 0,
        totalShopifyOrders,
        hasMore: false,
      })
    }

    let processed = 0
    let privateAssigned = 0
    let skipped = 0
    let failed = 0

    for (const row of rows) {
      try {
        const domain = extractEmailRootDomain(row.customerEmail)
        const isGeneric = isGenericEmailDomain(domain)
        const shippingCompany = companyFromAddress(row.shippingAddress)
        const billingCompany = companyFromAddress(row.billingAddress)
        if (!row.customerEmail || !isGeneric || shippingCompany || billingCompany) {
          skipped += 1
          processed += 1
          continue
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

        privateAssigned += 1
      } catch (error) {
        failed += 1
      } finally {
        processed += 1
      }
    }

    const hasMore = skip + rows.length < totalShopifyOrders
    return NextResponse.json({
      success: true,
      batch,
      processed,
      privateAssigned,
      skipped,
      failed,
      totalShopifyOrders,
      hasMore,
      nextBatch: hasMore ? batch + 1 : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run private customer backfill batch',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
