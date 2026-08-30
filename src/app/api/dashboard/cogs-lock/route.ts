import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/authz'
import {
  YMD_PATTERN,
  computeDayCogs,
  getCogsLockFrom,
  lockDay,
  toYmd,
  utcMidnight,
} from '@/lib/cogs-lock'

// Manual lock/unlock for a single delivery day. Day-to-day freezing is
// automatic once a "lock from" date is set (see /cogs-lock/settings); this
// route exists to re-lock a day after fixing its recipes, or to unlock one.

export const maxDuration = 60

/** List locks in a range, or preview what locking a given day would record. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const preview = (searchParams.get('preview') || '').trim()
    if (preview) {
      if (!YMD_PATTERN.test(preview)) {
        return NextResponse.json({ error: 'preview must be YYYY-MM-DD' }, { status: 400 })
      }
      const computed = await computeDayCogs(preview)
      const existing = await prisma.dailyCogsLock.findUnique({ where: { date: utcMidnight(preview) } })
      return NextResponse.json({
        date: preview,
        live: { ...computed, breakdown: undefined },
        locked: existing
          ? {
              costOfSales: existing.costOfSales,
              revenueExGst: existing.revenueExGst,
              orderCount: existing.orderCount,
              cogsCoveragePct: existing.cogsCoveragePct,
              lockedAt: existing.lockedAt,
              lockedByName: existing.lockedByName,
            }
          : null,
      })
    }

    const from = (searchParams.get('from') || '').trim()
    const to = (searchParams.get('to') || '').trim()
    const where = YMD_PATTERN.test(from) && YMD_PATTERN.test(to)
      ? { date: { gte: utcMidnight(from), lte: utcMidnight(to) } }
      : {}

    const [locks, lockFrom] = await Promise.all([
      prisma.dailyCogsLock.findMany({
        where,
        orderBy: { date: 'desc' },
        select: {
          date: true,
          revenueExGst: true,
          costOfSales: true,
          orderCount: true,
          cogsCoveragePct: true,
          lockedAt: true,
          lockedByName: true,
        },
      }),
      getCogsLockFrom(),
    ])

    return NextResponse.json({
      lockFrom,
      locks: locks.map((l) => ({ ...l, date: toYmd(l.date) })),
    })
  } catch (e) {
    console.error('❌ cogs-lock GET error:', e)
    return NextResponse.json({ error: 'Failed to load cost locks' }, { status: 500 })
  }
}

/** Lock (or re-lock) one delivery day at its current live cost. */
export async function POST(req: NextRequest) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const date = String(body?.date || '').trim()
    if (!YMD_PATTERN.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const session = await getServerSession(authOptions).catch(() => null)
    const email = session?.user?.email ?? null
    const me = email
      ? await prisma.staff.findUnique({ where: { email }, select: { id: true, firstName: true, lastName: true } })
      : null

    const computed = await lockDay(date, {
      userId: me?.id ?? null,
      name: me ? `${me.firstName} ${me.lastName}`.trim() : session?.user?.name ?? null,
    })

    return NextResponse.json({
      locked: true,
      date,
      costOfSales: computed.costOfSales,
      revenueExGst: computed.revenueExGst,
      orderCount: computed.orderCount,
      cogsCoveragePct: computed.cogsCoveragePct,
      uncostedQty: computed.uncostedQty,
    })
  } catch (e) {
    console.error('❌ cogs-lock POST error:', e)
    return NextResponse.json({ error: 'Failed to lock day' }, { status: 500 })
  }
}

/** Unlock a day so it follows live pricing again. */
export async function DELETE(req: NextRequest) {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const date = (searchParams.get('date') || '').trim()
    if (!YMD_PATTERN.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    await prisma.dailyCogsLock.deleteMany({ where: { date: utcMidnight(date) } })
    return NextResponse.json({ locked: false, date })
  } catch (e) {
    console.error('❌ cogs-lock DELETE error:', e)
    return NextResponse.json({ error: 'Failed to unlock day' }, { status: 500 })
  }
}
