import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTodayLocal, formatLocalDate } from '@/lib/date-utils'

function isAucklandAddress(sa: any): boolean {
  if (!sa) return false
  const city = String(sa.city || '').toLowerCase()
  const province = String(sa.province || '').toLowerCase()
  const country = String(sa.country || '').toLowerCase()
  const address1 = String(sa.address1 || '').toLowerCase()
  const address2 = String(sa.address2 || '').toLowerCase()
  const zip = String(sa.zip || '').trim()
  const full = [address1, address2, city, province].join(' ')
  // Province signal
  if (province.includes('auckland')) return true
  // Explicit Mt/Mount Wellington exemptions (Auckland)
  if (city === 'mt wellington' || city === 'mount wellington') return true
  // Auckland postcodes: 10xx
  if (/^10\d{2}$/.test(zip)) return true
  // Overseas guard
  if (country && !['nz', 'new zealand', 'new-zealand'].includes(country)) return false
  // Fallback string match
  return city.includes('auckland') || full.includes('auckland')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const region = (searchParams.get('region') || 'auckland').toLowerCase()

    const today = getTodayLocal()
    const date = dateParam || formatLocalDate(today)

    // Load all orders for the given delivery date
    const orders = await prisma.order.findMany({
      where: { deliveryDate: date },
      orderBy: { deliveryTime: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        deliveryTime: true,
        shippingAddress: true,
        totalPrice: true,
      }
    })

    // Filter to Auckland region if requested
    const filtered = region === 'auckland'
      ? orders.filter(o => isAucklandAddress(o.shippingAddress as any))
      : orders

    // Geocode with server-side API key
    const geocodeCache = new Map<string, { lat: number; lng: number }>()
    const defaultNZ = { lat: -36.8485, lng: 174.7633 }
    const buildAddress = (sa: any): string => {
      if (!sa) return ''
      const parts = [sa.address1, sa.address2, sa.city, sa.province, sa.zip, sa.country].filter(Boolean)
      return parts.join(', ')
    }
    async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
      const key = address.trim()
      if (!key) return null
      if (geocodeCache.has(key)) return geocodeCache.get(key)!
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY
        if (!apiKey) return null
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(key)}&key=${apiKey}`
        const resp = await fetch(url)
        if (!resp.ok) return null
        const data = await resp.json()
        if (data.status !== 'OK' || !data.results?.length) return null
        const loc = data.results[0].geometry.location
        const coords = { lat: Number(loc.lat), lng: Number(loc.lng) }
        geocodeCache.set(key, coords)
        return coords
      } catch {
        return null
      }
    }

    const points = await Promise.all(
      filtered.map(async (order, index) => {
        const sa = order.shippingAddress as any
        const address = buildAddress(sa) || 'Unknown Address'
        const resolved = await geocode(address)
        const coords = resolved ?? defaultNZ
        const coordinates: [number, number] = [coords.lat, coords.lng]
        return {
          orderId: order.id,
          orderNumber: order.orderNumber?.toString() || `Order ${index + 1}`,
          deliveryTime: order.deliveryTime || '12:00',
          address,
          coordinates,
          salesValue: Number(order.totalPrice || 0),
        }
      })
    )

    return NextResponse.json({ date, region, count: points.length, points })
  } catch (error) {
    console.error('❌ Error building deliveries map:', error)
    return NextResponse.json({ error: 'Failed to build deliveries map' }, { status: 500 })
  }
}



