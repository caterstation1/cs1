import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const config = await prisma.xeroPayrollConfig.findFirst()
  return NextResponse.json(config ?? null)
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const {
    tenantId,
    earningsRateIdOrdinaryHours,
    earningsRateIdReimbursement,
    earningsRateIdMileage,
    payrollCalendarId,
    defaultMileageRate,
  } = body
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }
  const config = await prisma.xeroPayrollConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      earningsRateIdOrdinaryHours: earningsRateIdOrdinaryHours ?? null,
      earningsRateIdReimbursement: earningsRateIdReimbursement ?? null,
      earningsRateIdMileage: earningsRateIdMileage ?? null,
      payrollCalendarId: payrollCalendarId ?? null,
      defaultMileageRate: typeof defaultMileageRate === 'number' ? defaultMileageRate : 0.8,
    },
    update: {
      earningsRateIdOrdinaryHours: earningsRateIdOrdinaryHours ?? undefined,
      earningsRateIdReimbursement: earningsRateIdReimbursement ?? undefined,
      earningsRateIdMileage: earningsRateIdMileage ?? undefined,
      payrollCalendarId: payrollCalendarId ?? undefined,
      defaultMileageRate: typeof defaultMileageRate === 'number' ? defaultMileageRate : undefined,
    },
  })
  return NextResponse.json(config)
}
