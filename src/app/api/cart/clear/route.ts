import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const city = (url.searchParams.get('city') || 'AKL').toUpperCase()
    await prisma.cartItem.deleteMany({ where: { city } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 })
  }
}


