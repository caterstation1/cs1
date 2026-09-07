import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { listConnections } from '@/lib/xero/token-store'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const conns = await listConnections()
  return NextResponse.json(conns)
}
