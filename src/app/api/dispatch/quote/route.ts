import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Simple quote: compute km using Google Distance Matrix; payout = km * perKmRate
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const { pickupAddress, dropoffAddress, perKmRate } = body
    let origin =
      pickupAddress ||
      process.env.BASE_ADDRESS ||
      process.env.NEXT_PUBLIC_BASE_ADDRESS ||
      '100 Queen Street, Auckland, New Zealand'
    let dest = dropoffAddress as string | undefined

    // Support orderId as alternative input
    if ((!origin || !dest) && body?.orderId) {
      const order = await prisma.order.findUnique({ where: { id: String(body.orderId) }, select: { shippingAddress: true } })
      const sa: any = typeof order?.shippingAddress === 'string' ? JSON.parse(order!.shippingAddress as any) : order?.shippingAddress
      dest = dest || [sa?.address1, sa?.address2, sa?.city, sa?.province, sa?.zip, sa?.country || 'New Zealand'].filter(Boolean).join(', ')
      origin =
        origin ||
        process.env.BASE_ADDRESS ||
        process.env.NEXT_PUBLIC_BASE_ADDRESS ||
        '100 Queen Street, Auckland, New Zealand'
    }
    if (!origin || !dest) return NextResponse.json({ error: 'Missing origin/destination' }, { status: 400 })
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 })
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${encodeURIComponent(
      origin,
    )}&destinations=${encodeURIComponent(dest)}&key=${key}`
    const resp = await fetch(url)
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('dispatch/quote: distance API failed', resp.status, txt)
      const rate = typeof perKmRate === 'number' ? perKmRate : 1
      // Graceful degrade: return zero km with nominal payout so UI can still proceed/edit
      return NextResponse.json({ km: 0, payout: Number((5 * rate).toFixed(2)), warning: 'distance_api_failed' })
    }
    const data = await resp.json()
    const element = data?.rows?.[0]?.elements?.[0]
    const meters = element?.distance?.value
    if (!meters) {
      console.error('dispatch/quote: response missing distance', JSON.stringify(data).slice(0, 500))
      const rate = typeof perKmRate === 'number' ? perKmRate : 1
      return NextResponse.json({ km: 0, payout: Number((5 * rate).toFixed(2)), warning: 'no_distance' })
    }
    const km = meters / 1000
    const rate = typeof perKmRate === 'number' ? perKmRate : 1
    const payout = km * rate
    return NextResponse.json({ km, payout: Number(payout.toFixed(2)) })
  } catch (e) {
    console.error('quote error', e)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

