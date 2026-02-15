import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const status = (searchParams.get('status') || '').trim().toLowerCase()

    const drivers = await prisma.dataDriver.findMany({
      include: {
        applications: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const filtered = drivers.filter((d) => {
      const matchesQ =
        !q ||
        (d.fullName?.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q) ||
          (d.email || '').toLowerCase().includes(q) ||
          (d.baseSuburb || '').toLowerCase().includes(q))
      const matchesStatus = !status || d.status.toLowerCase() === status
      return matchesQ && matchesStatus
    })

    return NextResponse.json(filtered)
  } catch (e) {
    console.error('datadrivers GET error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

