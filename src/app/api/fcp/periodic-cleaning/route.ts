import { NextRequest, NextResponse } from 'next/server'
import { FcpAssetType, FcpPeriodicFrequency } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

function parseFrequency(value: string | null): FcpPeriodicFrequency | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  return Object.values(FcpPeriodicFrequency).includes(normalized as FcpPeriodicFrequency)
    ? (normalized as FcpPeriodicFrequency)
    : null
}

function parseAssetType(value: string | null): FcpAssetType | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  return Object.values(FcpAssetType).includes(normalized as FcpAssetType)
    ? (normalized as FcpAssetType)
    : null
}

export async function GET() {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items = await prisma.fcpPeriodicCleaningTask.findMany({
    orderBy: [{ isActive: 'desc' }, { area: 'asc' }, { taskName: 'asc' }],
  })
  return NextResponse.json({ data: items })
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const taskName = String(body.taskName || '').trim()
  const area = String(body.area || '').trim()
  const frequency = parseFrequency(typeof body.frequency === 'string' ? body.frequency : null)
  const applyToAssetType = parseAssetType(typeof body.applyToAssetType === 'string' ? body.applyToAssetType : null)

  if (!taskName || !area || !frequency) {
    return NextResponse.json(
      { error: 'taskName, area and frequency are required' },
      { status: 400 }
    )
  }

  const item = await prisma.fcpPeriodicCleaningTask.create({
    data: {
      taskName,
      area,
      frequency,
      notes: String(body.notes || '').trim() || null,
      isActive: body.isActive !== false,
      applyToCars: body.applyToCars === true,
      applyToAssetType: applyToAssetType ?? null,
    },
  })

  return NextResponse.json({ data: item }, { status: 201 })
}
