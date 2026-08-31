/**
 * Sends an SMS to a staff member when they are rostered onto a shift.
 *
 * Deliberately conservative, because the blast radius of getting this wrong is
 * texting 30 real people:
 *  - Disabled unless ROSTER_ASSIGNMENT_ALERTS_ENABLED=true.
 *  - Even when enabled, stays in dry-run until ROSTER_ASSIGNMENT_ALERTS_MODE=live.
 *  - Even in live mode, only sends to staff on ROSTER_ASSIGNMENT_ALERT_ALLOWLIST
 *    unless ROSTER_ASSIGNMENT_ALERTS_ALLOW_ALL=true, so the owner can pilot on
 *    their own number before opening it to the team.
 *
 * Never throws: a failed alert must not cost the roster entry that triggered it.
 */
import { prisma } from '@/lib/prisma'
import { formatNZYMD } from '@/lib/date-utils'

const CLICKSEND_BASE_URL = 'https://rest.clicksend.com/v3'

/** Assignments created for one staff member within this window are treated as
 *  bulk entry (copy-a-shift-across-the-week, backfill) and alerted once only. */
const BULK_WINDOW_MS = 60_000
const BULK_THRESHOLD = 3

export type RosterAlertOutcome =
  | { status: 'disabled' }
  | { status: 'skipped'; reason: string }
  | { status: 'dry_run'; to: string; message: string }
  | { status: 'sent'; to: string }
  | { status: 'failed'; reason: string }

type AssignmentForAlert = {
  id: string
  staffId: string
  date: Date
  startTime: string | null
  endTime: string | null
  createdAt: Date
  notes?: string | null
  staff?: { firstName: string; phone: string; email: string } | null
  shiftType?: { name: string; startTime: string; endTime: string } | null
}

function envFlag(name: string): boolean {
  return String(process.env[name] || '').trim().toLowerCase() === 'true'
}

function allowlist(): string[] {
  return String(process.env.ROSTER_ASSIGNMENT_ALERT_ALLOWLIST || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * NZ mobile numbers to E.164. Returns null for anything that is not a mobile,
 * so we never bill a text to a landline or a malformed record.
 */
export function toNzMobileE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/[^\d+]/g, '')
  if (digits.startsWith('+64')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('64') && digits.startsWith('642')) digits = `0${digits.slice(2)}`
  if (!/^02\d{7,9}$/.test(digits)) return null
  return `+64${digits.slice(1)}`
}

function formatShiftDate(date: Date): string {
  const ymd = formatNZYMD(date)
  const [year, month, day] = ymd.split('-').map(Number)
  const asUtc = new Date(Date.UTC(year, month - 1, day))
  const weekday = asUtc.toLocaleDateString('en-NZ', { weekday: 'short', timeZone: 'UTC' })
  const monthName = asUtc.toLocaleDateString('en-NZ', { month: 'short', timeZone: 'UTC' })
  return `${weekday} ${day} ${monthName}`
}

function resolveTimes(assignment: AssignmentForAlert): { start: string | null; end: string | null } {
  return {
    start: assignment.startTime || assignment.shiftType?.startTime || null,
    end: assignment.endTime || assignment.shiftType?.endTime || null,
  }
}

export function buildRosterAlertMessage(assignment: AssignmentForAlert): string {
  const firstName = assignment.staff?.firstName?.trim() || 'there'
  const { start, end } = resolveTimes(assignment)
  const when = formatShiftDate(assignment.date)
  const window = start && end ? `${start}-${end}` : start ? `from ${start}` : 'time TBC'
  const shiftLabel = assignment.shiftType?.name ? ` (${assignment.shiftType.name})` : ''
  return `Hi ${firstName}, you're rostered at CaterStation on ${when}, ${window}${shiftLabel}. See the app for details.`
}

/**
 * Reasons to stay quiet even when fully enabled. Uses only existing
 * RosterAssignment rows, so it works across serverless instances without
 * needing a new table.
 */
async function suppressionReason(assignment: AssignmentForAlert): Promise<string | null> {
  const todayYmd = formatNZYMD(new Date())
  const shiftYmd = formatNZYMD(assignment.date)
  if (shiftYmd < todayYmd) return 'shift date is in the past (backfill)'

  const dayStart = new Date(assignment.date)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  // An earlier assignment for the same staff member on the same day means this
  // is a duplicate or a re-add, not news.
  const existingSameDay = await prisma.rosterAssignment.count({
    where: {
      staffId: assignment.staffId,
      id: { not: assignment.id },
      date: { gte: dayStart, lt: dayEnd },
      createdAt: { lt: assignment.createdAt },
    },
  })
  if (existingSameDay > 0) return 'staff member already had a shift on this date'

  const recentForStaff = await prisma.rosterAssignment.count({
    where: {
      staffId: assignment.staffId,
      id: { not: assignment.id },
      createdAt: { gte: new Date(assignment.createdAt.getTime() - BULK_WINDOW_MS) },
    },
  })
  if (recentForStaff >= BULK_THRESHOLD) return 'bulk roster entry detected'

  return null
}

async function sendClickSend(to: string, message: string): Promise<void> {
  const username = process.env.CLICKSEND_USERNAME
  const apiKey = process.env.CLICKSEND_API_KEY
  if (!username || !apiKey) throw new Error('Clicksend credentials not configured')
  const auth = Buffer.from(`${username}:${apiKey}`).toString('base64')

  const response = await fetch(`${CLICKSEND_BASE_URL}/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      messages: [{ source: process.env.CLICKSEND_SENDER_ID || 'CaterStation', body: message, to }],
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Clicksend responded ${response.status}: ${detail.slice(0, 200)}`)
  }
}

export async function notifyRosterAssignmentCreated(
  assignment: AssignmentForAlert
): Promise<RosterAlertOutcome> {
  try {
    if (!envFlag('ROSTER_ASSIGNMENT_ALERTS_ENABLED')) return { status: 'disabled' }

    const staff = assignment.staff
      ? assignment.staff
      : await prisma.staff.findUnique({
          where: { id: assignment.staffId },
          select: { firstName: true, phone: true, email: true },
        })
    if (!staff) return { status: 'skipped', reason: 'staff record not found' }

    const to = toNzMobileE164(staff.phone)
    if (!to) return { status: 'skipped', reason: 'no usable NZ mobile number on staff record' }

    const suppressed = await suppressionReason(assignment)
    if (suppressed) return { status: 'skipped', reason: suppressed }

    const message = buildRosterAlertMessage({ ...assignment, staff })

    const live = String(process.env.ROSTER_ASSIGNMENT_ALERTS_MODE || 'dry_run').trim().toLowerCase() === 'live'
    if (!live) return { status: 'dry_run', to, message }

    const permitted = allowlist()
    const allowAll = envFlag('ROSTER_ASSIGNMENT_ALERTS_ALLOW_ALL')
    if (!allowAll) {
      const identifiers = [staff.email?.toLowerCase(), to].filter(Boolean) as string[]
      if (permitted.length === 0) {
        return { status: 'skipped', reason: 'live mode requires an allowlist or ALLOW_ALL' }
      }
      if (!identifiers.some((id) => permitted.includes(id))) {
        return { status: 'skipped', reason: 'recipient not on allowlist' }
      }
    }

    await sendClickSend(to, message)
    return { status: 'sent', to }
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'unknown roster alert failure',
    }
  }
}