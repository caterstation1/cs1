import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const assignment = await prisma.rosterAssignment.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        },
        shiftType: true
      }
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'Roster assignment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error fetching roster assignment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roster assignment' },
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

    const assignment = await prisma.rosterAssignment.update({
      where: { id },
      data: {
        shiftTypeId: data.shiftTypeId,
        notes: data.notes
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        },
        shiftType: true
      }
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error updating roster assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update roster assignment' },
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
    await prisma.rosterAssignment.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting roster assignment:', error)
    return NextResponse.json(
      { error: 'Failed to delete roster assignment' },
      { status: 500 }
    )
  }
} 