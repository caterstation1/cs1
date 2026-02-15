import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendLoginInvitation } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json().catch(() => ({}))
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const staff = await prisma.staff.findUnique({ where: { email } })
    if (!staff) {
      // Avoid leaking which emails exist
      return NextResponse.json({ success: true })
    }
    const result = await sendLoginInvitation(staff.id)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send reset' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('POST /api/auth/request-reset failed', e)
    return NextResponse.json({ error: 'Failed to request reset' }, { status: 500 })
  }
}



