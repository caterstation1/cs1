// Admin-only staffing notes for a roster day. The 403 here is the access
// control — the drawer panel hides itself off the back of it, but a reader who
// is not admin or owner must not be able to reach the note by calling the API.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { parseCalendarRegion } from '@/lib/calendar-query'

const ALLOWED_ROLES = ['admin', 'owner']
const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_NOTE_LENGTH = 2000

async function canManage(): Promise<boolean> {
  const role = await getAccessLevel()
  return ALLOWED_ROLES.includes(String(role || '').toLowerCase())
}

const NOTE_FIELDS = {
  id: true,
  note: true,
  updatedAt: true,
  updatedByName: true,
} as const

export async function GET(request: NextRequest) {
  if (!(await canManage())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const region = parseCalendarRegion(searchParams.get('region'))
  const date = (searchParams.get('date') || '').trim()

  if (!region || !YMD_PATTERN.test(date)) {
    return NextResponse.json(
      { error: 'region must be AKL or WLG and date must be YYYY-MM-DD' },
      { status: 400 }
    )
  }

  try {
    const note = await prisma.rosterAdminNote.findUnique({
      where: { region_date: { region, date } },
      select: NOTE_FIELDS,
    })
    return NextResponse.json({ note })
  } catch (error) {
    console.error('GET /api/roster/admin-notes failed:', error)
    return NextResponse.json({ error: 'Failed to fetch roster note' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await canManage())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const region = parseCalendarRegion(body?.region ?? null)
  const date = typeof body?.date === 'string' ? body.date.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : ''

  if (!region || !YMD_PATTERN.test(date)) {
    return NextResponse.json(
      { error: 'region must be AKL or WLG and date must be YYYY-MM-DD' },
      { status: 400 }
    )
  }

  try {
    // Clearing the box is how a note is removed, so an empty body deletes the
    // row rather than leaving a blank one that still reports an editor.
    if (!note) {
      await prisma.rosterAdminNote.deleteMany({ where: { region, date } })
      return NextResponse.json({ note: null })
    }

    const session = await getServerSession(authOptions)
    const updatedByEmail = session?.user?.email ?? null
    const updatedByName = session?.user?.name ?? updatedByEmail

    const saved = await prisma.rosterAdminNote.upsert({
      where: { region_date: { region, date } },
      create: { region, date, note, updatedByEmail, updatedByName },
      update: { note, updatedByEmail, updatedByName },
      select: NOTE_FIELDS,
    })

    return NextResponse.json({ note: saved })
  } catch (error) {
    console.error('PUT /api/roster/admin-notes failed:', error)
    return NextResponse.json({ error: 'Failed to save roster note' }, { status: 500 })
  }
}
