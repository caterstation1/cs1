import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/authz'
import { getXeroClient } from '@/lib/xero/client'
import { saveToken } from '@/lib/xero/token-store'

export async function GET(req: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const client = getXeroClient(req.nextUrl.origin)
  if (!client) {
    return NextResponse.redirect(new URL('/timesheet?xero=error', req.url))
  }
  const url = new URL(req.url)
  const fullCallbackUrl = `${url.origin}${url.pathname}${url.search}`
  const tokenSet = await client.apiCallback(fullCallbackUrl)
  await client.updateTenants(true)
  const tenants = client.tenants
  for (const t of tenants) {
    await saveToken(t.tenantId, t.tenantName || null, tokenSet as any)
  }
  return NextResponse.redirect(new URL('/timesheet?xero=connected', req.url))
}
