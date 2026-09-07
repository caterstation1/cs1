import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { aggregatePayrollInputs } from '@/lib/payroll/aggregate'
import {
  getPayRuns,
  getPayRunCalendars,
  createPayRun,
  createTimesheet,
  createTimesheetLine,
  approveTimesheet,
} from '@/lib/xero/payroll'
import { addDaysNZ } from '@/lib/date-utils'

export async function POST(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = await prisma.staff.findUnique({ where: { email }, select: { id: true } })
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const weekStart = body.weekStart as string
    const staffOverrides = (body.staffOverrides || {}) as Record<string, { hours?: number; mileageKm?: number; mileageDollars?: number; reimbursements?: number }>
    const dryRun = body.dryRun === true

    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'weekStart (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const config = await prisma.xeroPayrollConfig.findFirst()
    const connections = await prisma.xeroConnection.findMany({
      select: { tenantId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    const tenantId = config?.tenantId ?? connections[0]?.tenantId ?? null
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active Xero connection found. Click Connect Xero, then retry.' },
        { status: 400 }
      )
    }

    let payrollCalendarId = config?.payrollCalendarId ?? null
    if (!payrollCalendarId) {
      const calendarsRes = await getPayRunCalendars(tenantId)
      const calendars = (calendarsRes as any)?.payRunCalendars ?? []
      payrollCalendarId = calendars?.[0]?.payrollCalendarID ?? null
      if (!payrollCalendarId) {
        return NextResponse.json(
          { error: 'No payroll calendar available in Xero. Configure payroll calendar and retry.' },
          { status: 400 }
        )
      }
    }
    const earningsOrdinary = config?.earningsRateIdOrdinaryHours ?? null
    const earningsReimb = config?.earningsRateIdReimbursement ?? null
    const earningsMileage = config?.earningsRateIdMileage ?? null
    const defaultMileageRate = config?.defaultMileageRate ?? 0.8

    const result = await aggregatePayrollInputs(weekStart, {
      defaultMileageRate,
      staffOverrides,
    })

    const staffWithData = result.staff.filter(
      (s) => (s.hours > 0 || s.mileageDollars > 0 || s.reimbursements > 0) && s.xeroEmployeeId
    )
    const staffWithoutXero = result.staff.filter(
      (s) => (s.hours > 0 || s.mileageDollars > 0 || s.reimbursements > 0) && !s.xeroEmployeeId
    )
    if (staffWithoutXero.length > 0) {
      return NextResponse.json(
        {
          error: 'Some staff have hours/reimbursements but no Xero employee mapping',
          staff: staffWithoutXero.map((s) => s.name),
        },
        { status: 400 }
      )
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        wouldCreate: staffWithData.length,
        payPeriodStart: result.payPeriodStart,
        payPeriodEnd: result.payPeriodEnd,
      })
    }

    const existingPosted = await prisma.payrollRun.findFirst({
      where: { payPeriodStart: weekStart, status: 'posted' },
    })
    if (existingPosted) {
      return NextResponse.json(
        { error: 'A payrun for this week has already been posted. Use adjustment workflow if needed.' },
        { status: 409 }
      )
    }

    const weekEnd = addDaysNZ(weekStart, 6)

    const existingPayruns = await getPayRuns(tenantId, 'Draft')
    const matchingDraft = (existingPayruns as any)?.payRuns?.find(
      (pr: any) =>
        pr.periodStartDate === weekStart &&
        pr.periodEndDate === weekEnd &&
        pr.payrollCalendarID === payrollCalendarId
    )

    let payrunId: string
    if (matchingDraft) {
      payrunId = matchingDraft.payRunID
    } else {
      const created = await createPayRun(tenantId, {
        payrollCalendarID: payrollCalendarId,
        payRunType: 'Scheduled',
      })
      payrunId = (created as any)?.payRuns?.[0]?.payRunID
      if (!payrunId) {
        return NextResponse.json({ error: 'Failed to create Xero payrun' }, { status: 502 })
      }
    }

    for (const s of staffWithData) {
      const lines: { date: string; earningsRateID: string; numberOfUnits: number }[] = []
      if (earningsOrdinary && s.hours > 0) {
        lines.push({
          date: weekStart,
          earningsRateID: earningsOrdinary,
          numberOfUnits: s.hours,
        })
      }
      if (earningsMileage && s.mileageDollars > 0) {
        lines.push({
          date: weekStart,
          earningsRateID: earningsMileage,
          numberOfUnits: s.mileageDollars,
        })
      }
      if (earningsReimb && s.reimbursements > 0) {
        lines.push({
          date: weekStart,
          earningsRateID: earningsReimb,
          numberOfUnits: s.reimbursements,
        })
      }
      if (lines.length === 0) continue

      try {
        const timesheet = await createTimesheet(tenantId, {
          payrollCalendarID: payrollCalendarId,
          employeeID: s.xeroEmployeeId!,
          startDate: weekStart,
          endDate: weekEnd,
          timesheetLines: lines,
        })
        const tsId = (timesheet as any)?.timesheets?.[0]?.timesheetID
        if (tsId) {
          await approveTimesheet(tenantId, tsId)
        }
      } catch (e: unknown) {
        const err = e as { response?: { body?: unknown; status?: number }; message?: string }
        return NextResponse.json(
          {
            error: `Failed while creating timesheet for ${s.name}`,
            staff: s.name,
            details: err.response?.body ?? err.message ?? String(e),
          },
          { status: typeof err.response?.status === 'number' ? err.response.status : 502 }
        )
      }
    }

    const inputSnapshot = Object.fromEntries(
      result.staff.map((s) => [
        s.staffId,
        { hours: s.hours, mileageKm: s.mileageKm, mileageDollars: s.mileageDollars, reimbursements: s.reimbursements },
      ])
    )

    const run = await prisma.payrollRun.create({
      data: {
        payPeriodStart: weekStart,
        payPeriodEnd: weekEnd,
        xeroPayrunId: payrunId,
        createdBy: me.id,
        status: 'draft',
        inputSnapshot,
      },
    })

    return NextResponse.json({
      payrollRunId: run.id,
      xeroPayrunId: payrunId,
      status: 'draft',
    })
  } catch (e: unknown) {
    console.error('payroll draft error', e)
    const err = e as { response?: { body?: unknown }; message?: string }
    return NextResponse.json(
      {
        error: 'Failed to create draft payrun',
        details: err.response?.body ?? err.message ?? String(e),
      },
      { status: typeof (err as any).response?.status === 'number' ? (err as any).response.status : 502 }
    )
  }
}
