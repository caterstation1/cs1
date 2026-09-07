import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { parseFrequency, parseTriggerType } from '@/lib/fcp/bridge'
import type { FcpApiResponse } from '@/types/fcp'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')?.trim() || undefined
  const triggerTypeParam = searchParams.get('triggerType')
  const frequencyParam = searchParams.get('frequency')

  const triggerType = parseTriggerType(triggerTypeParam)
  if (triggerTypeParam && !triggerType) {
    return NextResponse.json(
      { error: 'Invalid triggerType filter value' },
      { status: 400 }
    )
  }

  const frequency = parseFrequency(frequencyParam)
  if (frequencyParam && !frequency) {
    return NextResponse.json(
      { error: 'Invalid frequency filter value' },
      { status: 400 }
    )
  }

  const where: Prisma.FcpRuleWhereInput = {
    isActive: true,
    ...(triggerType ? { triggerType } : {}),
    ...(frequency ? { frequency } : {}),
    ...(category
      ? {
          config: {
            path: ['dashboardCategory'],
            equals: category,
          },
        }
      : {}),
  }

  try {
    const rules = await prisma.fcpRule.findMany({
      where,
      include: {
        card: true,
      },
      orderBy: [{ severity: 'desc' }, { name: 'asc' }],
    })

    const response: FcpApiResponse<typeof rules> = {
      data: rules,
      meta: {
        count: rules.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('fcp rules GET error', error)
    return NextResponse.json({ error: 'Failed to fetch FCP rules' }, { status: 500 })
  }
}
