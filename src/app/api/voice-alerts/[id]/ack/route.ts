import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.voiceAlert.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Voice alert not found' }, { status: 404 })
    }
    if (existing.acknowledgedAt) {
      return NextResponse.json({ ok: true })
    }

    await prisma.voiceAlert.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/voice-alerts/[id]/ack failed:', error)
    return NextResponse.json({ error: 'Failed to acknowledge voice alert' }, { status: 500 })
  }
}
