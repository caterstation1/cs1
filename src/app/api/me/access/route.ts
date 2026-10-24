import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ accessLevel: null, firstName: null }, { status: 200 })
    }
    const me = await prisma.staff.findUnique({
      where: { email },
      select: { accessLevel: true, firstName: true },
    })
    // firstName also backs the voice-alert identity picker, which can't rely on
    // useSession() resolving in time.
    const sessionFirstName = (session?.user?.name || '').trim().split(' ')[0] || null
    return NextResponse.json({
      accessLevel: me?.accessLevel || null,
      firstName: me?.firstName || sessionFirstName,
    })
  } catch (e) {
    return NextResponse.json({ accessLevel: null, firstName: null }, { status: 200 })
  }
}

