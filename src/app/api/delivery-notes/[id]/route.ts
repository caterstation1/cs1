import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.deliveryAddressNote.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/delivery-notes/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to delete delivery note' }, { status: 500 })
  }
}
