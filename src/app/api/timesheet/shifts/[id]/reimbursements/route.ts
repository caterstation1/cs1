import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const reimbursement = await prisma.reimbursement.create({
      data: {
        shiftId: id,
        amount: data.amount,
        description: data.description
      }
    })

    return NextResponse.json(reimbursement)
  } catch (error) {
    console.error('Error creating reimbursement:', error)
    return NextResponse.json(
      { error: 'Failed to create reimbursement' },
      { status: 500 }
    )
  }
} 