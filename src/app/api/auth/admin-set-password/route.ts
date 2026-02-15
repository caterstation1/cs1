import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, password, token } = await req.json()
    if (!email || !password || !token) {
      return NextResponse.json({ error: 'email, password and token are required' }, { status: 400 })
    }

    // Use NEXTAUTH_SECRET as the admin guard token (no new env needed)
    const adminToken = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
    if (!adminToken || token !== adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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



