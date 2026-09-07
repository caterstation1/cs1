import { NextRequest, NextResponse } from 'next/server'
import { FcpAssetType, type Prisma } from '@/generated/prisma'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import type { FcpApiResponse } from '@/types/fcp'

function parseAssetType(value: string | null): FcpAssetType | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  return Object.values(FcpAssetType).includes(normalized as FcpAssetType)
    ? (normalized as FcpAssetType)
    : null
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get('type')
  const type = parseAssetType(typeParam)

  if (typeParam && !type) {
    return NextResponse.json({ error: 'Invalid asset type filter' }, { status: 400 })
  }

  const where: Prisma.FcpAssetWhereInput = {
    isActive: true,
    ...(type ? { type } : {}),
  }

  try {
    const assets = await prisma.fcpAsset.findMany({
      where,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    })

    const response: FcpApiResponse<typeof assets> = {
      data: assets,
      meta: {
        count: assets.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('fcp assets GET error', error)
    return NextResponse.json({ error: 'Failed to fetch FCP assets' }, { status: 500 })
  }
}
