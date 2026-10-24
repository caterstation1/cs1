import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeRecipient, VOICE_ALERT_MAX_AGE_MS } from '@/lib/voice-alerts'

const MAX_MESSAGE_LENGTH = 500

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = normalizeRecipient(searchParams.get('recipient'))

    if (!recipient) {
      return NextResponse.json({ error: 'Missing required parameter: recipient' }, { status: 400 })
    }

    const alerts = await prisma.voiceAlert.findMany({
      where: {
        recipient: { equals: recipient, mode: 'insensitive' },
        acknowledgedAt: null,
        createdAt: { gte: new Date(Date.now() - VOICE_ALERT_MAX_AGE_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        id: true,
        recipient: true,
        message: true,
        createdAt: true,
        createdByName: true,
      },
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('GET /api/voice-alerts failed:', error)
    return NextResponse.json({ error: 'Failed to fetch voice alerts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const recipient = normalizeRecipient(body?.recipient)
    const message = typeof body?.message === 'string' ? body.message.trim() : ''

    if (!recipient || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: recipient, message' },
        { status: 400 }
      )
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
        { status: 400 }
      )
    }

    const alert = await prisma.voiceAlert.create({
      data: {
        recipient,
        message,
        createdByEmail: session.user.email,
        createdByName: session.user.name ?? session.user.email,
      },
      select: {
        id: true,
        recipient: true,
        message: true,
        createdAt: true,
        createdByName: true,
      },
    })

    return NextResponse.json({ alert }, { status: 201 })
  } catch (error) {
    console.error('POST /api/voice-alerts failed:', error)
    return NextResponse.json({ error: 'Failed to send voice alert' }, { status: 500 })
  }
}
