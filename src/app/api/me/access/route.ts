import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ accessLevel: null }, { status: 200 })
    }
    const me = await prisma.staff.findUnique({
      where: { email },
      select: { accessLevel: true },
    })
    return NextResponse.json({ accessLevel: me?.accessLevel || null })
  } catch (e) {
    return NextResponse.json({ accessLevel: null }, { status: 200 })
  }
}

