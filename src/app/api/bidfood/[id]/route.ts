import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.bidfoodProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}



