import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Check access level via Staff table
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const active = await prisma.shift.findMany({
      where: { clockOut: null, status: 'active' },
      include: { staff: true },
      orderBy: { clockIn: 'asc' },
    })

    const payload = active.map(s => ({
      id: s.id,
      clockIn: s.clockIn,
      date: s.date,
      staff: {
        id: s.staffId,
        firstName: (s as any).staff?.firstName || '',
        lastName: (s as any).staff?.lastName || '',
        phone: (s as any).staff?.phone || '',
      },
    }))

    return NextResponse.json(payload)
  } catch (error) {
    console.error('❌ Error fetching active shifts:', error)
    return NextResponse.json({ error: 'Failed to fetch active shifts' }, { status: 500 })
  }
}

