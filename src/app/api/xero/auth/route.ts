import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getXeroClient, isXeroConfigured } from '@/lib/xero/client'
import { requireRole } from '@/lib/authz'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isXeroConfigured()) {
    return NextResponse.json({ error: 'Xero is not configured' }, { status: 400 })
  }
  const client = getXeroClient(req.nextUrl.origin)
  if (!client) return NextResponse.json({ error: 'Xero client unavailable' }, { status: 500 })
  const consentUrl = await client.buildConsentUrl()
  return NextResponse.redirect(consentUrl)
}
