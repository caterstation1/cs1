import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import {
  recalculateCompanies,
  writeCompanyAssignmentAudit,
} from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json()
    const domain = String(body?.domain || '').trim().toLowerCase()
    const reason = String(body?.reason || '').trim() || 'Marked generic/private from admin workflow'
    if (!domain) {
      return NextResponse.json({ error: 'domain is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.genericDomain.upsert({
        where: { domain },
        create: {
          domain,
          reason,
          addedBy: role,
        },
        update: {
          reason,
          addedBy: role,
        },
      })

      const impactedOrders = await tx.companyOrder.findMany({
        where: {
          OR: [
            {
              company: {
                primaryDomain: domain,
              },
            },
            {
              company: {
                alternateDomains: {
                  has: domain,
                },
              },
            },
          ],
          matchMethod: { in: ['DOMAIN_EXACT', 'DOMAIN_AND_ADDRESS'] },
        },
        select: {
          companyId: true,
          shopifyOrderId: true,
        },
      })

      for (const row of impactedOrders) {
        await tx.companyMatchReview.create({
          data: {
            proposedCompanyId: row.companyId,
            proposedCompanyName: `Review due to generic domain: ${domain}`,
            existingCompanyId: null,
            existingCompanyName: null,
            matchReason: `Domain marked generic/private (${domain})`,
            confidenceScore: 40,
            orderIds: [row.shopifyOrderId],
            status: 'pending',
          },
        })
      }

      await writeCompanyAssignmentAudit(tx, {
        actionType: 'mark_domain_generic',
        oldValue: { domain, impactedOrderCount: impactedOrders.length },
        newValue: { domain, reason },
        reason,
        createdBy: role,
      })

      await recalculateCompanies(
        tx,
        Array.from(new Set(impactedOrders.map((row) => row.companyId)))
      )

      return { domain, impactedOrderCount: impactedOrders.length }
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to mark domain generic/private' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
