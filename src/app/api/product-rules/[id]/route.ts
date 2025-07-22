import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rule = await prisma.productRule.findUnique({
      where: { id }
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching rule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rule' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const rule = await prisma.productRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        priority: data.priority,
        matchPattern: data.matchPattern,
        matchType: data.matchType,
        setDisplayName: data.setDisplayName,
        setMeat1: data.setMeat1,
        setMeat2: data.setMeat2,
        setTimer1: data.setTimer1,
        setTimer2: data.setTimer2,
        setOption1: data.setOption1,
        setOption2: data.setOption2,
        setServeware: data.setServeware,
        setIngredients: data.setIngredients,
        setTotalCost: data.setTotalCost,
      }
    })

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.productRule.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete product rule' },
      { status: 500 }
    )
  }
} 