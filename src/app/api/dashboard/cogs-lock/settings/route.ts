import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import {
  YMD_PATTERN,
  autoLockCompletedDays,
  getCogsLockFrom,
  setCogsLockFrom,
  todayNZ,
} from '@/lib/cogs-lock'

// The "lock costs from" date. Set it once pricing is trusted and every
// completed delivery day from then on freezes automatically.

// Setting a date in the past catches up on every outstanding day in one go.
export const maxDuration = 300

export async function GET() {
  try {
    return NextResponse.json({ lockFrom: await getCogsLockFrom(), today: todayNZ() })
  } catch (e) {
    console.error('❌ cogs-lock settings GET error:', e)
    return NextResponse.json({ error: 'Failed to load cost lock settings' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const raw = body?.lockFrom
    const lockFrom = raw === null || raw === '' ? null : String(raw).trim()
    if (lockFrom !== null && !YMD_PATTERN.test(lockFrom)) {
      return NextResponse.json({ error: 'lockFrom must be YYYY-MM-DD or null' }, { status: 400 })
    }

    const saved = await setCogsLockFrom(lockFrom)

    // Catch up immediately so the setting takes effect without waiting for the
    // nightly run. Backdating to the start of the year is ~200 days, hence the
    // generous cap and the extended function duration.
    const result = saved ? await autoLockCompletedDays({ limit: 400 }) : null

    return NextResponse.json({
      lockFrom: saved,
      lockedNow: result?.locked ?? [],
      remaining: result?.remaining ?? 0,
    })
  } catch (e) {
    console.error('❌ cogs-lock settings PUT error:', e)
    return NextResponse.json({ error: 'Failed to save cost lock settings' }, { status: 500 })
  }
}
