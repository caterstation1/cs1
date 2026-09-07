import { NextRequest, NextResponse } from 'next/server'
import { FcpIncidentStatus } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { parseEnumParam } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let payload: { status?: string } = {}
  try {
    payload = (await request.json()) as { status?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = parseEnumParam(payload.status ?? null, FcpIncidentStatus)
  if (!status) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  const now = new Date()
  const data: {
    status: typeof status
    resolvedAt?: Date | null
    closedAt?: Date | null
  } = { status }

  if (status === 'RESOLVED') {
    data.resolvedAt = now
  }
  if (status === 'CLOSED') {
    data.closedAt = now
    if (!data.resolvedAt) data.resolvedAt = now
  }

  try {
    const updated = await prisma.fcpIncident.update({
      where: { id },
      data,
    })
    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 })
  }
}
