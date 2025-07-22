import { NextRequest, NextResponse } from 'next/server'
import { sendLoginInvitation } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Received invite request for staff ID:', id)
    const result = await sendLoginInvitation(id)

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Invitation sent successfully' })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send invitation' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
} 