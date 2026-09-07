// Recent email ingestions with their reports — how Peter checks what a
// forwarded price email actually did (matched, unmatched, price changes).

import { NextRequest, NextResponse } from 'next/server'
import { getAccessLevel } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const role = await getAccessLevel()
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 25, 100)
    const ingestions = await prisma.emailIngestion.findMany({
      orderBy: { receivedAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ ingestions })
  } catch (error) {
    console.error('❌ /api/pricing/ingestions failed:', error)
    return NextResponse.json({ error: 'Failed to list ingestions' }, { status: 500 })
  }
}
