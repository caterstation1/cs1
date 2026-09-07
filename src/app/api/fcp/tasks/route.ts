import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { getDateWhereClause, isYmd, parseTaskStatus } from '@/lib/fcp/bridge'
import { prisma } from '@/lib/prisma'
import type { FcpApiResponse } from '@/types/fcp'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const dateParam = searchParams.get('date')
  const category = searchParams.get('category')?.trim() || undefined
  const relatedOrderId = searchParams.get('relatedOrderId')?.trim() || undefined

  const status = parseTaskStatus(statusParam)
  if (statusParam && !status) {
    return NextResponse.json({ error: 'Invalid status filter value' }, { status: 400 })
  }

  if (dateParam && !isYmd(dateParam)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const where: Prisma.FcpTaskWhereInput = {
    ...(status ? { status } : {}),
    ...(dateParam ? { dueAt: getDateWhereClause(dateParam) } : {}),
    ...(relatedOrderId ? { orderId: relatedOrderId } : {}),
    ...(category
      ? {
          rule: {
            config: {
              path: ['dashboardCategory'],
              equals: category,
            },
          },
        }
      : {}),
  }

  try {
    const tasks = await prisma.fcpTask.findMany({
      where,
      include: {
        rule: {
          include: {
            card: true,
          },
        },
        asset: true,
        incident: true,
        records: {
          orderBy: [{ recordedAt: 'desc' }],
          take: 20,
          include: {
            recordType: true,
            asset: true,
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    })

    const response: FcpApiResponse<typeof tasks> = {
      data: tasks,
      meta: {
        count: tasks.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('fcp tasks GET error', error)
    return NextResponse.json({ error: 'Failed to fetch FCP tasks' }, { status: 500 })
  }
}
