import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.calendarDayAlert.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }
    if (existing.dismissedAt) {
      return NextResponse.json({ ok: true })
    }

    await prisma.calendarDayAlert.update({
      where: { id },
      data: { dismissedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/calendar/alerts/[id]/dismiss failed:', error)
    return NextResponse.json({ error: 'Failed to dismiss alert' }, { status: 500 })
  }
}
