import { NextRequest, NextResponse } from 'next/server'
import { FcpIncidentStatus, FcpSeverity } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { parseEnumParam } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'
import type { CreateFcpIncidentInput, FcpApiResponse } from '@/types/fcp'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const status = parseEnumParam(statusParam, FcpIncidentStatus)
  if (statusParam && !status) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  const incidents = await prisma.fcpIncident.findMany({
    where: {
      ...(status ? { status } : {}),
    },
    include: {
      rule: {
        select: { code: true, name: true },
      },
      asset: {
        select: { id: true, name: true, code: true, location: true },
      },
    },
    orderBy: [{ openedAt: 'desc' }],
    take: 200,
  })

  return NextResponse.json({ data: incidents })
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: CreateFcpIncidentInput
  try {
    payload = (await request.json()) as CreateFcpIncidentInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = payload.title?.trim()
  const description = payload.description?.trim() || ''
  const relatedOrderId = payload.relatedOrderId?.trim() || undefined
  const sourceRecordId = payload.sourceRecordId?.trim() || undefined
  const openedById = payload.openedById?.trim() || undefined
  const severity = parseEnumParam(payload.severity ?? null, FcpSeverity) ?? 'HIGH'

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (payload.severity && !parseEnumParam(payload.severity, FcpSeverity)) {
    return NextResponse.json({ error: 'Invalid severity value' }, { status: 400 })
  }

  try {
    let sourceRecord:
      | {
          id: string
          ruleId: string
          assetId: string | null
          orderId: string | null
        }
      | null = null

    if (sourceRecordId) {
      sourceRecord = await prisma.fcpRecord.findUnique({
        where: { id: sourceRecordId },
        select: {
          id: true,
          ruleId: true,
          assetId: true,
          orderId: true,
        },
      })
      if (!sourceRecord) {
        return NextResponse.json({ error: 'sourceRecordId not found' }, { status: 404 })
      }
    }

    const detailLines = [description]
    if (sourceRecordId) detailLines.push(`Source record: ${sourceRecordId}`)
    if (openedById) detailLines.push(`Opened by: ${openedById}`)
    const fullDescription = detailLines.filter(Boolean).join('\n')

    const incident = await prisma.fcpIncident.create({
      data: {
        title,
        description: fullDescription || null,
        severity,
        status: 'OPEN',
        orderId: relatedOrderId ?? sourceRecord?.orderId ?? null,
        ruleId: sourceRecord?.ruleId ?? null,
        assetId: sourceRecord?.assetId ?? null,
      },
    })

    const response: FcpApiResponse<typeof incident> = {
      data: incident,
      meta: {
        sourceRecordLinked: Boolean(sourceRecordId),
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('fcp incidents POST error', error)
    return NextResponse.json({ error: 'Failed to create FCP incident' }, { status: 500 })
  }
}
