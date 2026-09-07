import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { listRewardCatalog, upsertRewardCatalogItem } from '@/lib/lifecycle/reward-catalog-service'

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
    const rows = await listRewardCatalog()
    return NextResponse.json({ success: true, rows })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load reward catalog' }, { status: error?.status || 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const body = await request.json()
    const row = await upsertRewardCatalogItem(body)
    return NextResponse.json({ success: true, row })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update reward catalog' }, { status: error?.status || 500 })
  }
}
