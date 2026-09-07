import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseCalendarRegion } from '@/lib/calendar-query'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = parseCalendarRegion(searchParams.get('region'))
    const date = searchParams.get('date')

    if (!region || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters: region, date' },
        { status: 400 }
      )
    }

    const alert = await prisma.calendarDayAlert.findFirst({
      where: { region, date, dismissedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        createdAt: true,
        createdByName: true,
      },
    })

    return NextResponse.json({ alert })
  } catch (error) {
    console.error('GET /api/calendar/alerts failed:', error)
    return NextResponse.json({ error: 'Failed to fetch alert' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const region = parseCalendarRegion(body.region ?? null)
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!region || !date || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: region, date, message' },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions)
    const createdByEmail = session?.user?.email ?? null
    const createdByName = session?.user?.name ?? createdByEmail

    await prisma.calendarDayAlert.updateMany({
      where: { region, date, dismissedAt: null },
      data: { dismissedAt: new Date() },
    })

    const alert = await prisma.calendarDayAlert.create({
      data: {
        region,
        date,
        message,
        createdByEmail,
        createdByName,
      },
      select: {
        id: true,
        message: true,
        createdAt: true,
        createdByName: true,
      },
    })

    return NextResponse.json({ alert }, { status: 201 })
  } catch (error) {
    console.error('POST /api/calendar/alerts failed:', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}
