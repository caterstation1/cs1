// Freezes yesterday's cost of sales, once an owner has set a "lock from" date.
//
// Runs at 15:30 UTC ≈ 03:30 NZT, after the nightly reprice, so the frozen cost
// reflects supplier prices as at the day of dispatch rather than whenever the
// figure happens to be looked at months later.

import { NextRequest, NextResponse } from 'next/server'
import { autoLockCompletedDays } from '@/lib/cogs-lock'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (process.env.CRON_SECRET && !isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // A generous limit so a missed run catches up rather than falling behind.
    const result = await autoLockCompletedDays({ limit: 60 })

    if (!result.lockFrom) {
      console.log('ℹ️  [lock-daily-cogs] No lock-from date set; nothing to do')
    } else {
      console.log(
        `✅ [lock-daily-cogs] from ${result.lockFrom}: locked ${result.locked.length} day(s)` +
          `${result.locked.length ? ` (${result.locked.join(', ')})` : ''}; ${result.remaining} still outstanding`
      )
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('❌ [lock-daily-cogs] Failed:', error)
    return NextResponse.json(
      { error: 'Daily cost lock failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
