import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { aggregatePayrollInputs } from '@/lib/payroll/aggregate'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const weekStart = body.weekStart as string
    const staffOverrides = (body.staffOverrides || {}) as Record<string, { hours?: number; mileageKm?: number; mileageDollars?: number; reimbursements?: number }>
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'weekStart (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const config = await prisma.xeroPayrollConfig.findFirst()
    const defaultMileageRate = config?.defaultMileageRate ?? 0.8

    const result = await aggregatePayrollInputs(weekStart, {
      defaultMileageRate,
      staffOverrides,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('payroll preview error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
