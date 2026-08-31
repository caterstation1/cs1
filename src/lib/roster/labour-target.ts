// What a rostered day is planned to cost, against the 10%-of-delivered-sales
// budget the shop runs to.
//
// The cost rule is deliberately the same one the owner dashboard uses for
// actual worked shifts (hours x Staff.payRate, see staffCostsBetween in
// /api/dashboard and fetchShiftLabour in src/lib/accounting.ts). A roster is a
// plan and a Shift is what happened, so the inputs differ — planned start/end
// times rather than clock-in/clock-out — but the rate applied must not, or the
// roster and the dashboard would disagree about what the same person costs.
//
// Nothing here is on-costs. payRate is the gross hourly rate: no holiday pay,
// no KiwiSaver, no ACC, no unpaid-break deduction and no overtime multiplier,
// because none of those are modelled anywhere in this codebase yet.

/** Share of delivered sales the day's rostered labour is budgeted against. */
export const LABOUR_TARGET_RATE = 0.1

export interface RosterShiftInput {
  id: string
  staffId: string
  staffName: string
  payRate: number | null | undefined
  /** Times from the shift type when one is attached, else the custom pair. */
  startTime: string | null | undefined
  endTime: string | null | undefined
}

/** A rostered shift we deliberately refused to cost, and why. */
export interface UncostedShift {
  id: string
  staffName: string
  reason: 'no-pay-rate' | 'no-times'
}

export interface RosterDayCost {
  cost: number
  hours: number
  shiftCount: number
  /** Shifts excluded from `cost` — the understatement risk, surfaced. */
  uncosted: UncostedShift[]
}

export type LabourTone = 'green' | 'amber' | 'red'

function round2(n: number): number {
  return Number((Math.round(n * 100) / 100).toFixed(2))
}

/** Minutes past midnight for "HH:MM", or null if it is not a time. */
function minutesOfDay(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Paid hours between two "HH:MM" times. An end at or before the start is read
 * as an overnight shift, matching how the roster grid already renders duration.
 */
export function shiftHours(startTime: string | null | undefined, endTime: string | null | undefined): number | null {
  const start = minutesOfDay(startTime)
  const end = minutesOfDay(endTime)
  if (start === null || end === null) return null
  const span = end > start ? end - start : end + 24 * 60 - start
  return span / 60
}

/**
 * Costs one day's roster. A staff member with no usable pay rate is reported
 * rather than costed at zero: a missing rate would make the day look cheaper
 * than it is, which is the one failure mode this panel exists to avoid.
 */
export function rosterDayCost(shifts: RosterShiftInput[]): RosterDayCost {
  let cost = 0
  let hours = 0
  const uncosted: UncostedShift[] = []

  for (const shift of shifts) {
    const shiftLength = shiftHours(shift.startTime, shift.endTime)
    if (shiftLength === null) {
      uncosted.push({ id: shift.id, staffName: shift.staffName, reason: 'no-times' })
      continue
    }
    hours += shiftLength

    // payRate is a non-null Float, so an unset rate reaches us as 0. Zero is
    // not a lawful wage, so it means "not on file" rather than "free".
    const rate = Number(shift.payRate)
    if (!Number.isFinite(rate) || rate <= 0) {
      uncosted.push({ id: shift.id, staffName: shift.staffName, reason: 'no-pay-rate' })
      continue
    }
    cost += rate * shiftLength
  }

  return { cost: round2(cost), hours: round2(hours), shiftCount: shifts.length, uncosted }
}

/** The day's labour budget: 10% of what was delivered, ex-GST. */
export function labourTarget(salesExGst: number): number {
  return round2(Math.max(0, salesExGst) * LABOUR_TARGET_RATE)
}

/**
 * Under budget is green, a small overrun amber, a real overrun red — the
 * green/amber/red idiom the Products tab uses for margin health. A day with no
 * sales to measure against gets no verdict at all.
 */
export function labourTone(cost: number, target: number | null): LabourTone | null {
  if (target === null) return null
  if (target <= 0) return cost > 0 ? 'red' : 'green'
  const ratio = cost / target
  if (ratio <= 1) return 'green'
  if (ratio <= 1.15) return 'amber'
  return 'red'
}
