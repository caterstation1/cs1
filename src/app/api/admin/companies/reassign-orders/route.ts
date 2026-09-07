import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import {
  ensureCompanyByName,
  recalculateCompanies,
  writeCompanyAssignmentAudit,
} from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json()
    const orderIds = Array.isArray(body?.shopifyOrderIds)
      ? body.shopifyOrderIds.map((value: unknown) => String(value)).filter(Boolean)
      : []
    const targetCompanyIdRaw = String(body?.targetCompanyId || '').trim()
    const targetCompanyName = String(body?.targetCompanyName || '').trim()
    const targetDomain = String(body?.targetDomain || '').trim() || null
    const reason = String(body?.reason || '').trim() || null
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'shopifyOrderIds is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const targetCompanyId =
        targetCompanyIdRaw ||
        (targetCompanyName
          ? await ensureCompanyByName(tx, { name: targetCompanyName, domain: targetDomain, createdBy: role })
          : '')
      if (!targetCompanyId) throw new Error('targetCompanyId or targetCompanyName is required')

      const impacted = await tx.companyOrder.findMany({
        where: { shopifyOrderId: { in: orderIds } },
        select: {
          companyId: true,
          shopifyOrderId: true,
        },
      })
      const previousCompanyIds = Array.from(new Set(impacted.map((row) => row.companyId)))

      await tx.companyOrder.updateMany({
        where: {
          shopifyOrderId: { in: orderIds },
        },
        data: {
          companyId: targetCompanyId,
          matchMethod: 'MANUAL_OVERRIDE',
          confidenceScore: 100,
          matchReason: `Manual order reassignment to ${targetCompanyId}`,
        },
      })

      for (const order of impacted) {
        await writeCompanyAssignmentAudit(tx, {
          actionType: 'reassign_order',
          oldCompanyId: order.companyId,
          newCompanyId: targetCompanyId,
          shopifyOrderId: order.shopifyOrderId,
          oldValue: { shopifyOrderId: order.shopifyOrderId, oldCompanyId: order.companyId },
          newValue: { shopifyOrderId: order.shopifyOrderId, newCompanyId: targetCompanyId },
          reason,
          createdBy: role,
        })
      }

      await recalculateCompanies(tx, [...previousCompanyIds, targetCompanyId])
      return {
        reassignedOrders: impacted.length,
        targetCompanyId,
      }
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to reassign orders' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
