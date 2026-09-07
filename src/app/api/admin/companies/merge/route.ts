import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { recalculateCompanies, writeCompanyAssignmentAudit } from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json()
    const sourceCompanyId = String(body?.sourceCompanyId || '')
    const targetCompanyId = String(body?.targetCompanyId || '')
    const reason = String(body?.reason || '').trim() || null
    if (!sourceCompanyId || !targetCompanyId || sourceCompanyId === targetCompanyId) {
      return NextResponse.json({ error: 'Valid sourceCompanyId and targetCompanyId are required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.company.findUnique({ where: { companyId: sourceCompanyId } }),
        tx.company.findUnique({ where: { companyId: targetCompanyId } }),
      ])
      if (!source || !target) throw new Error('Source or target company not found')

      await tx.companyOrder.updateMany({
        where: { companyId: sourceCompanyId },
        data: {
          companyId: targetCompanyId,
          matchMethod: 'MANUAL_OVERRIDE',
          confidenceScore: 100,
          matchReason: `Manual merge from ${sourceCompanyId} into ${targetCompanyId}`,
        },
      })
      await tx.companyContact.updateMany({
        where: { companyId: sourceCompanyId },
        data: { companyId: targetCompanyId },
      })
      await tx.company.update({
        where: { companyId: targetCompanyId },
        data: {
          companyNameVariants: Array.from(
            new Set([...(target.companyNameVariants || []), ...(source.companyNameVariants || []), source.canonicalCompanyName])
          ),
          alternateDomains: Array.from(
            new Set([...(target.alternateDomains || []), ...(source.alternateDomains || []), source.primaryDomain || null].filter(Boolean) as string[])
          ),
          confidenceScore: Math.max(target.confidenceScore, source.confidenceScore),
        },
      })

      await writeCompanyAssignmentAudit(tx, {
        actionType: 'merge_company',
        oldCompanyId: sourceCompanyId,
        newCompanyId: targetCompanyId,
        oldValue: { sourceName: source.canonicalCompanyName },
        newValue: { targetName: target.canonicalCompanyName },
        reason,
        createdBy: role,
      })

      // Preserve source company as archived shell with no orders/contacts.
      await tx.company.update({
        where: { companyId: sourceCompanyId },
        data: {
          canonicalCompanyName: `${source.canonicalCompanyName} (merged into ${target.canonicalCompanyName})`,
          primaryDomain: null,
          alternateDomains: [],
          confidenceScore: 0,
        },
      })

      await recalculateCompanies(tx, [sourceCompanyId, targetCompanyId])
      return {
        sourceCompanyId,
        targetCompanyId,
      }
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to merge companies' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
