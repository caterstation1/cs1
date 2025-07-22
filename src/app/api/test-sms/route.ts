import { NextRequest, NextResponse } from 'next/server'

// Clicksend API configuration
const CLICKSEND_BASE_URL = 'https://rest.clicksend.com/v3'
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY
const CLICKSEND_SENDER_ID = process.env.CLICKSEND_SENDER_ID || 'CaterStation'

// Create Basic Auth header for Clicksend
const getAuthHeader = () => {
  if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
    throw new Error('Clicksend credentials not configured')
  }
  const credentials = `${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`
  const encodedCredentials = Buffer.from(credentials).toString('base64')
  return `Basic ${encodedCredentials}`
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, message } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const testMessage = message || 'Test SMS from CaterStation - Clicksend integration working!'

    // Send SMS via Clicksend
    const clicksendResponse = await fetch(`${CLICKSEND_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        messages: [
          {
            source: CLICKSEND_SENDER_ID,
            body: testMessage,
            to: phoneNumber
          }
        ]
      })
    })

    if (!clicksendResponse.ok) {
      const errorData = await clicksendResponse.json()
      console.error('Clicksend API error:', errorData)
      return NextResponse.json(
        { error: `Clicksend API error: ${clicksendResponse.status}`, details: errorData },
        { status: clicksendResponse.status }
      )
    }

    const clicksendData = await clicksendResponse.json()
    
    return NextResponse.json({
      success: true,
      messageId: clicksendData.data?.messages?.[0]?.message_id || 'unknown',
      status: 'SUCCESS',
      provider: 'clicksend',
      response: clicksendData
    })

  } catch (error) {
    console.error('Error sending test SMS:', error)
    return NextResponse.json(
      { error: 'Failed to send test SMS', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 