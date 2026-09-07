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
    const sourceCompanyId = String(body?.sourceCompanyId || '')
    const targetCompanyIdRaw = String(body?.targetCompanyId || '').trim()
    const targetCompanyName = String(body?.targetCompanyName || '').trim()
    const targetDomain = String(body?.targetDomain || '').trim() || null
    const shopifyOrderIds = Array.isArray(body?.shopifyOrderIds)
      ? body.shopifyOrderIds.map((value: unknown) => String(value)).filter(Boolean)
      : []
    const contactIds = Array.isArray(body?.contactIds)
      ? body.contactIds.map((value: unknown) => String(value)).filter(Boolean)
      : []
    const reason = String(body?.reason || '').trim() || null
    if (!sourceCompanyId || (!shopifyOrderIds.length && !contactIds.length)) {
      return NextResponse.json(
        { error: 'sourceCompanyId and either shopifyOrderIds or contactIds are required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const targetCompanyId =
        targetCompanyIdRaw ||
        (targetCompanyName
          ? await ensureCompanyByName(tx, { name: targetCompanyName, domain: targetDomain, createdBy: role })
          : '')
      if (!targetCompanyId) throw new Error('targetCompanyId or targetCompanyName is required')

      if (contactIds.length > 0) {
        await tx.companyContact.updateMany({
          where: { contactId: { in: contactIds }, companyId: sourceCompanyId },
          data: { companyId: targetCompanyId },
        })
      }
      if (shopifyOrderIds.length > 0) {
        await tx.companyOrder.updateMany({
          where: { shopifyOrderId: { in: shopifyOrderIds }, companyId: sourceCompanyId },
          data: {
            companyId: targetCompanyId,
            matchMethod: 'MANUAL_OVERRIDE',
            confidenceScore: 100,
            matchReason: `Manual split from ${sourceCompanyId} to ${targetCompanyId}`,
          },
        })
      }

      await writeCompanyAssignmentAudit(tx, {
        actionType: 'split_company',
        oldCompanyId: sourceCompanyId,
        newCompanyId: targetCompanyId,
        oldValue: { sourceCompanyId, contactIds, shopifyOrderIds },
        newValue: { targetCompanyId, movedContacts: contactIds.length, movedOrders: shopifyOrderIds.length },
        reason,
        createdBy: role,
      })

      await recalculateCompanies(tx, [sourceCompanyId, targetCompanyId])
      return {
        sourceCompanyId,
        targetCompanyId,
        movedContacts: contactIds.length,
        movedOrders: shopifyOrderIds.length,
      }
    })
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to split company' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
