import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/authz'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['owner', 'admin'])
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const me = await prisma.staff.findUnique({ where: { email }, select: { id: true } })
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const shift = await prisma.shift.findUnique({ where: { id } })
    if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedBy: me.id,
      },
      include: { staff: true, reimbursements: true },
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const err = e as { status?: number }
    if (err?.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('approve shift error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
