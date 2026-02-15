import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const city = (url.searchParams.get('city') || 'AKL').toUpperCase()
    const items = await prisma.cartItem.findMany({
      where: { city },
      orderBy: { updatedAt: 'desc' }
    })
    return NextResponse.json(items)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }
}


