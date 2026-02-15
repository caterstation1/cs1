import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/env.mjs'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ publicId: string[] }> }
) {
  try {
    const { publicId } = await context.params
    const session = await getServerSession(authOptions)
    const email = session?.user?.email || null
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const me = await prisma.staff.findUnique({ where: { email }, select: { accessLevel: true } })
    const lvl = me?.accessLevel || 'basic'
    if (!(lvl === 'admin' || lvl === 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const cloudName = env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }
    const joined = (publicId || []).join('/')
    if (!joined) {
      return NextResponse.json({ error: 'publicId required' }, { status: 400 })
    }
    // Note: This is an access-gated redirect to the secure delivery URL.
    // For full restriction, store as authenticated and serve via token-based URLs.
    const url = `https://res.cloudinary.com/${cloudName}/image/upload/${encodeURIComponent(joined)}`
    return NextResponse.redirect(url, { status: 302 })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

