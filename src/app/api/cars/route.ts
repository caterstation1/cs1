import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cars = await prisma.car.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(cars)
  } catch (e) {
    console.error('GET /api/cars failed', e)
    return NextResponse.json({ error: 'Failed to fetch cars' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const car = await prisma.car.create({
      data: {
        name: data.name,
        rego: data.rego,
        wofExpiry: data.wofExpiry ? new Date(data.wofExpiry) : null,
        regoExpiry: data.regoExpiry ? new Date(data.regoExpiry) : null,
      },
    })
    return NextResponse.json(car, { status: 201 })
  } catch (e) {
    console.error('POST /api/cars failed', e)
    return NextResponse.json({ error: 'Failed to create car' }, { status: 500 })
  }
}



