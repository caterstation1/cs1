import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const limitParam = _req.nextUrl.searchParams.get('limit')
    const limit = Math.min(Math.max(Number(limitParam || 200), 50), 2000)

    const recent = await prisma.order.findMany({
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
      take: limit,
    })

    const orderNumbers = recent.map(r => r.orderNumber).filter(n => Number.isFinite(n))
    if (orderNumbers.length === 0) {
      return NextResponse.json({ missingNumbers: [], latest: null, checked: 0, timestamp: new Date().toISOString() })
    }

    // Compute gaps among recent order numbers
    const missingNumbers: number[] = []
    for (let i = 0; i < orderNumbers.length - 1; i++) {
      const current = orderNumbers[i]
      const next = orderNumbers[i + 1]
      // Expect strictly decreasing by 1 between adjacent recent orders
      for (let v = current - 1; v > next; v--) {
        // Limit to a reasonable window to avoid flooding if historical gaps exist
        if (missingNumbers.length < 50) missingNumbers.push(v)
      }
    }

    return NextResponse.json({
      missingNumbers,
      latest: orderNumbers[0],
      checked: orderNumbers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to check missing orders' }, { status: 500 })
  }
}

