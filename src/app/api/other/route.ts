import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.otherProduct.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching other products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
} 