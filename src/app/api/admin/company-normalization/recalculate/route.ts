import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { recalculateCompanies } from '@/lib/company-normalization-admin'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json().catch(() => ({}))
    const companyIds = Array.isArray(body?.companyIds)
      ? body.companyIds.map((value: unknown) => String(value)).filter(Boolean)
      : []
    const fullRefresh = Boolean(body?.fullRefresh)

    await prisma.$transaction(async (tx) => {
      const ids =
        fullRefresh || companyIds.length === 0
          ? (
              await tx.company.findMany({
                select: { companyId: true },
              })
            ).map((row) => row.companyId)
          : companyIds
      await recalculateCompanies(tx, ids)
    })

    return NextResponse.json({
      success: true,
      companyCount: companyIds.length,
      fullRefresh,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to recalculate company normalization metrics' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
