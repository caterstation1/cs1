import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { extractEmailRootDomain } from '@/lib/company-matching'

export const SEEDED_GENERIC_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'hotmail.co.nz',
  'outlook.com',
  'yahoo.com',
  'yahoo.co.nz',
  'icloud.com',
  'me.com',
  'live.com',
  'protonmail.com',
  'xtra.co.nz',
  'xtra.com',
  'school.nz',
  'net.nz',
])

export async function getGenericDomainsSet(tx?: Prisma.TransactionClient): Promise<Set<string>> {
  const db = tx || prisma
  const rows = await db.genericDomain.findMany({
    select: { domain: true },
  })
  const merged = new Set<string>(SEEDED_GENERIC_DOMAINS)
  for (const row of rows) {
    merged.add(row.domain.toLowerCase().trim())
  }
  return merged
}

export function isGenericDomain(domain: string | null | undefined, genericDomains: Set<string>): boolean {
  if (!domain) return false
  const root = extractEmailRootDomain(`noreply@${domain}`) || domain.toLowerCase().trim()
  return genericDomains.has(root)
}

export async function recalculateCompanyTotals(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<void> {
  const rows = await tx.companyOrder.findMany({
    where: { companyId },
    select: {
      shopifyOrderId: true,
      orderTotal: true,
      orderDate: true,
    },
  })
  const uniqueByOrderId = new Map<string, { orderTotal: number; orderDate: Date }>()
  for (const row of rows) {
    uniqueByOrderId.set(row.shopifyOrderId, {
      orderTotal: Number(row.orderTotal || 0),
      orderDate: row.orderDate,
    })
  }
  const uniqueOrders = Array.from(uniqueByOrderId.values()).sort(
    (a, b) => a.orderDate.getTime() - b.orderDate.getTime()
  )
  const totalOrders = uniqueOrders.length
  const totalRevenue = uniqueOrders.reduce((sum, row) => sum + row.orderTotal, 0)
  const firstOrderDate = uniqueOrders[0]?.orderDate || null
  const lastOrderDate = uniqueOrders.at(-1)?.orderDate || null

  await tx.company.update({
    where: { companyId },
    data: {
      totalOrders,
      totalRevenue,
      firstOrderDate,
      lastOrderDate,
    },
  })
}

export async function recalculateCompanyContacts(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<void> {
  const contacts = await tx.companyContact.findMany({
    where: { companyId },
    select: {
      contactId: true,
      email: true,
      shopifyCustomerId: true,
    },
  })
  for (const contact of contacts) {
    const orders = await tx.companyOrder.findMany({
      where: {
        companyId,
        OR: [
          contact.shopifyCustomerId ? { shopifyCustomerId: contact.shopifyCustomerId } : undefined,
          contact.email ? { shopifyCustomerId: null } : undefined,
        ].filter(Boolean) as Prisma.CompanyOrderWhereInput[],
      },
      select: {
        shopifyOrderId: true,
        orderTotal: true,
        orderDate: true,
      },
    })

    const unique = new Map<string, { orderTotal: number; orderDate: Date }>()
    for (const row of orders) {
      unique.set(row.shopifyOrderId, {
        orderTotal: Number(row.orderTotal || 0),
        orderDate: row.orderDate,
      })
    }
    const values = Array.from(unique.values()).sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime())
    await tx.companyContact.update({
      where: { contactId: contact.contactId },
      data: {
        totalOrders: values.length,
        totalSpend: values.reduce((sum, row) => sum + row.orderTotal, 0),
        firstOrderDate: values[0]?.orderDate || null,
        lastOrderDate: values.at(-1)?.orderDate || null,
      },
    })
  }
}

export async function recalculateCompanies(tx: Prisma.TransactionClient, companyIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(companyIds.filter(Boolean)))
  for (const companyId of uniqueIds) {
    await recalculateCompanyTotals(tx, companyId)
    await recalculateCompanyContacts(tx, companyId)
  }
}

export async function writeCompanyAssignmentAudit(
  tx: Prisma.TransactionClient,
  input: {
    actionType:
      | 'rename_company'
      | 'mark_domain_generic'
      | 'reassign_contact'
      | 'reassign_order'
      | 'merge_company'
      | 'split_company'
      | 'mark_private'
    oldCompanyId?: string | null
    newCompanyId?: string | null
    shopifyCustomerId?: string | null
    shopifyOrderId?: string | null
    oldValue?: Prisma.InputJsonValue | null
    newValue?: Prisma.InputJsonValue | null
    reason?: string | null
    createdBy?: string | null
  }
) {
  return tx.companyAssignmentAudit.create({
    data: {
      actionType: input.actionType,
      oldCompanyId: input.oldCompanyId || null,
      newCompanyId: input.newCompanyId || null,
      shopifyCustomerId: input.shopifyCustomerId || null,
      shopifyOrderId: input.shopifyOrderId || null,
      oldValue: input.oldValue ?? Prisma.JsonNull,
      newValue: input.newValue ?? Prisma.JsonNull,
      reason: input.reason || null,
      createdBy: input.createdBy || null,
    },
  })
}

export async function ensureCompanyByName(
  tx: Prisma.TransactionClient,
  input: { name: string; domain?: string | null; createdBy?: string | null }
): Promise<string> {
  const normalizedName = input.name.trim()
  const existing = await tx.company.findFirst({
    where: {
      OR: [
        { canonicalCompanyName: normalizedName },
        input.domain ? { primaryDomain: input.domain.toLowerCase().trim() } : undefined,
      ].filter(Boolean) as Prisma.CompanyWhereInput[],
    },
    select: { companyId: true },
  })
  if (existing) return existing.companyId

  const created = await tx.company.create({
    data: {
      canonicalCompanyName: normalizedName,
      companyNameVariants: [normalizedName],
      primaryDomain: input.domain ? input.domain.toLowerCase().trim() : null,
      alternateDomains: input.domain ? [input.domain.toLowerCase().trim()] : [],
      confidenceScore: 90,
    },
    select: { companyId: true },
  })
  await writeCompanyAssignmentAudit(tx, {
    actionType: 'split_company',
    newCompanyId: created.companyId,
    reason: 'Created company from manual workflow',
    createdBy: input.createdBy || null,
    newValue: { name: normalizedName, domain: input.domain || null },
  })
  return created.companyId
}
