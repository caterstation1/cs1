import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { status, availability, phone, email: bodyEmail, baseSuburb, internalNotes } = body || {}

    const updated = await prisma.dataDriver.update({
      where: { id },
      data: {
        status: typeof status === 'string' ? status : undefined,
        availability: typeof availability === 'boolean' ? availability : undefined,
        phone: typeof phone === 'string' ? phone.trim() : undefined,
        email: typeof bodyEmail === 'string' ? bodyEmail.trim() : undefined,
        baseSuburb: typeof baseSuburb === 'string' ? baseSuburb.trim() : undefined,
        internalNotes: typeof internalNotes === 'string' ? internalNotes : undefined,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('datadrivers PUT error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

