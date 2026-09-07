import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getLifecycleCompanies } from '@/lib/lifecycle/lifecycle-admin-service'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const limit = Math.max(1, Math.min(1000, Number(request.nextUrl.searchParams.get('limit') || 300)))
    const rows = await getLifecycleCompanies(limit)
    return NextResponse.json({ success: true, count: rows.length, rows })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load lifecycle companies' }, { status: error?.status || 500 })
  }
}
