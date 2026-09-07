import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { writeCompanyAssignmentAudit } from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const body = await request.json()
    const companyId = String(body?.companyId || '')
    const newCanonicalName = String(body?.newCanonicalName || '').trim()
    const reason = String(body?.reason || '').trim() || null
    if (!companyId || !newCanonicalName) {
      return NextResponse.json({ error: 'companyId and newCanonicalName are required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { companyId },
        select: { canonicalCompanyName: true },
      })
      if (!company) throw new Error('Company not found')

      await tx.company.update({
        where: { companyId },
        data: {
          canonicalCompanyName: newCanonicalName,
        },
      })
      await writeCompanyAssignmentAudit(tx, {
        actionType: 'rename_company',
        oldCompanyId: companyId,
        newCompanyId: companyId,
        oldValue: { canonicalCompanyName: company.canonicalCompanyName },
        newValue: { canonicalCompanyName: newCanonicalName },
        reason,
        createdBy: role,
      })
      return { companyId, oldName: company.canonicalCompanyName, newName: newCanonicalName }
    })

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to rename company' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
