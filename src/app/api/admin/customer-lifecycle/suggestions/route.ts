import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getLifecycleSuggestions } from '@/lib/lifecycle/lifecycle-eligibility'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const limit = Math.max(1, Math.min(1000, Number(request.nextUrl.searchParams.get('limit') || 500)))
    const rows = await getLifecycleSuggestions(limit)
    return NextResponse.json({ success: true, rows, count: rows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load lifecycle suggestions' }, { status: error?.status || 500 })
  }
}
