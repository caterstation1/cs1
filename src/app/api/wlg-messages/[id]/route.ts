import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAccessLevel } from '@/lib/authz'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAccessLevel()
    if (!access || !['admin', 'owner', 'wlg_admin'].includes(access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['new', 'understood', 'actioned', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const message = await prisma.wLGMessage.update({
      where: { id },
      data: {
        status,
        statusChangedAt: new Date()
      },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { creator: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Error updating message:', error)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAccessLevel()
    if (!access || !['admin', 'owner'].includes(access)) {
      return NextResponse.json({ error: 'Forbidden - Admin/Owner only' }, { status: 403 })
    }

    const { id } = await params
    await prisma.wLGMessage.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}



