import { NextRequest, NextResponse } from 'next/server'
import { sendLoginInvitation } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Received invite request for staff ID:', params.id)
    const result = await sendLoginInvitation(params.id)
    
    if (!result.success) {
      console.error('Failed to send invitation:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to send invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in invite route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 