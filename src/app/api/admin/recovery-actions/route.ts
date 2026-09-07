import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { recalculateCompanies } from '@/lib/company-normalization-admin'

const FALLBACK_OPTIONS = [
  'Emailed',
  'Founder Email',
  'Assigned contact',
  'Offered $100 Voucher',
  'Offered small station',
  'Offered large station',
  'Offered side option',
  'Offered CaterCase',
  'Posted mail',
]

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin', 'manager'])
    const companyId = (request.nextUrl.searchParams.get('companyId') || '').trim()
    const [options, actions] = await Promise.all([
      prisma.recoveryActionOption
        .findMany({
          orderBy: [{ label: 'asc' }],
          select: { optionId: true, label: true },
        })
        .catch(() => []),
      companyId
        ? prisma.companyRecoveryAction.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: {
              recoveryActionId: true,
              actionLabel: true,
              note: true,
              createdBy: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ])
    return NextResponse.json({
      options: options.length ? options.map((row) => row.label) : FALLBACK_OPTIONS,
      actions: actions.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load recovery actions' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await requireRole(['owner', 'admin', 'manager'])
    const body = await request.json()
    const companyId = String(body?.companyId || '').trim()
    const actionLabelRaw = String(body?.actionLabel || '').trim()
    const customActionRaw = String(body?.customAction || '').trim()
    const note = String(body?.note || '').trim() || null
    const actionLabel = (customActionRaw || actionLabelRaw).trim()
    if (!companyId || !actionLabel) {
      return NextResponse.json({ error: 'companyId and actionLabel/customAction are required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.recoveryActionOption.upsert({
        where: { label: actionLabel },
        create: { label: actionLabel, createdBy: role },
        update: {},
      })
      const action = await tx.companyRecoveryAction.create({
        data: {
          companyId,
          actionLabel,
          note,
          createdBy: role,
        },
      })
      await recalculateCompanies(tx, [companyId])
      return action
    })

    return NextResponse.json({
      success: true,
      action: {
        ...result,
        createdAt: result.createdAt.toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save recovery action' },
      { status: error?.status === 403 ? 403 : 500 }
    )
  }
}
