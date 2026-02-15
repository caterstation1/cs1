import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT update email setting
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, recipientEmail, isActive } = body

    const setting = await prisma.emailSetting.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(recipientEmail && { recipientEmail }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ setting })
  } catch (error) {
    console.error('Error updating email setting:', error)
    return NextResponse.json(
      { error: 'Failed to update email setting' },
      { status: 500 }
    )
  }
}

// DELETE email setting
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.emailSetting.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Email setting deleted successfully' })
  } catch (error) {
    console.error('Error deleting email setting:', error)
    return NextResponse.json(
      { error: 'Failed to delete email setting' },
      { status: 500 }
    )
  }
}



