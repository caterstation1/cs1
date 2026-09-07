/**
 * Aggregates approved shifts, mileage, reimbursements per staff for a pay period.
 * Supports fixed-hours staff (include even with 0 clocked hours).
 */
import { prisma } from '@/lib/prisma'
import { getNZDateRangeForYmd, addDaysNZ } from '@/lib/date-utils'

export type StaffPayrollInput = {
  staffId: string
  name: string
  xeroEmployeeId: string | null
  payMode: string | null
  fixedWeeklyHours: number | null
  hours: number
  mileageKm: number
  mileageDollars: number
  reimbursements: number
  warnings: string[]
}

export type PayrollAggregationResult = {
  payPeriodStart: string
  payPeriodEnd: string
  staff: StaffPayrollInput[]
  defaultMileageRate: number
}

export async function aggregatePayrollInputs(
  weekStart: string,
  options: {
    defaultMileageRate?: number
    staffOverrides?: Record<string, { hours?: number; mileageKm?: number; mileageDollars?: number; reimbursements?: number }>
  } = {}
): Promise<PayrollAggregationResult> {
  const { defaultMileageRate = 0.8, staffOverrides = {} } = options
  const weekEnd = addDaysNZ(weekStart, 6)
  const { start: startDt } = getNZDateRangeForYmd(weekStart)
  const { end: endDt } = getNZDateRangeForYmd(weekEnd)

  const shifts = await prisma.shift.findMany({
    where: {
      date: { gte: startDt, lte: endDt },
      approved: true,
    },
    include: { staff: true, reimbursements: true },
  })

  const allStaff = await prisma.staff.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      xeroEmployeeId: true,
      payMode: true,
      fixedWeeklyHours: true,
    },
  })

  const byStaff = new Map<string, { hours: number; mileageKm: number; reimbursements: number }>()
  for (const s of shifts) {
    const key = s.staffId
    const cur = byStaff.get(key) || { hours: 0, mileageKm: 0, reimbursements: 0 }
    cur.hours += typeof s.totalHours === 'number' ? s.totalHours : 0
    cur.mileageKm += typeof s.mileage === 'number' ? s.mileage : 0
    cur.reimbursements += Array.isArray(s.reimbursements)
      ? s.reimbursements.reduce((a, r) => a + (r.amount || 0), 0)
      : 0
    byStaff.set(key, cur)
  }

  const staff: StaffPayrollInput[] = []
  for (const st of allStaff) {
    const agg = byStaff.get(st.id) || { hours: 0, mileageKm: 0, reimbursements: 0 }
    const overrides = staffOverrides[st.id] || {}
    let hours = overrides.hours ?? (st.payMode === 'FIXED_WEEKLY_HOURS' && (agg.hours === 0) ? (st.fixedWeeklyHours ?? 0) : agg.hours)
    const mileageKm = overrides.mileageKm ?? agg.mileageKm
    const reimbursements = overrides.reimbursements ?? agg.reimbursements
    const mileageDollars = overrides.mileageDollars ?? mileageKm * defaultMileageRate

    const warnings: string[] = []
    if (!st.xeroEmployeeId) warnings.push('Missing Xero employee mapping')
    if (hours > 0 || mileageKm > 0 || reimbursements > 0 || mileageDollars > 0) {
      if (!st.xeroEmployeeId) {
        // only include in output if they have data
      }
    }

    staff.push({
      staffId: st.id,
      name: `${st.firstName} ${st.lastName}`.trim(),
      xeroEmployeeId: st.xeroEmployeeId,
      payMode: st.payMode,
      fixedWeeklyHours: st.fixedWeeklyHours,
      hours,
      mileageKm,
      mileageDollars,
      reimbursements,
      warnings,
    })
  }

  return {
    payPeriodStart: weekStart,
    payPeriodEnd: weekEnd,
    staff: staff.sort((a, b) => a.name.localeCompare(b.name)),
    defaultMileageRate,
  }
}
