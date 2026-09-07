import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requireRole } from '@/lib/authz'

export async function POST(req: NextRequest) {
  try {
    // Admin-only: setting another user's password requires an authenticated
    // admin/owner session (previously guarded only by a shared secret token).
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const staff = await prisma.staff.findUnique({
      where: { email: String(email).toLowerCase() }
    })
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const hash = await bcrypt.hash(String(password), 10)
    await prisma.staff.update({
      where: { id: staff.id },
      data: { password: hash }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('admin-set-password error', e)
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
  }
}



