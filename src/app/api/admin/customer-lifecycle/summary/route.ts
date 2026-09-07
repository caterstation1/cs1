import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getLifecycleSummary } from '@/lib/lifecycle/lifecycle-admin-service'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
    const summary = await getLifecycleSummary()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load lifecycle summary' }, { status: error?.status || 500 })
  }
}
