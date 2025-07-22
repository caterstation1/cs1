import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🚀 SMS API called - Starting SMS send process')
  
  try {
    const { id } = await params
    const { driverPhone } = await request.json()

    console.log('📱 SMS Request Details:', {
      orderId: id,
      driverPhone: driverPhone,
      timestamp: new Date().toISOString()
    })

    if (!driverPhone) {
      console.log('❌ Error: No driver phone number provided')
      return NextResponse.json(
        { error: 'Driver phone number is required' },
        { status: 400 }
      )
    }

    // Fetch the order with all details
    console.log('🔍 Fetching order from database...')
    const order = await prisma.order.findUnique({
      where: { id }
    })

    if (!order) {
      console.log('❌ Error: Order not found in database')
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    console.log('✅ Order found:', {
      orderNumber: order.orderNumber,
      customerName: `${order.customerFirstName} ${order.customerLastName}`,
      deliveryTime: order.deliveryTime,
      totalPrice: order.totalPrice
    })

    // Format the SMS message
    console.log('📝 Formatting SMS message...')
    const message = formatOrderSMS(order)
    console.log('📨 SMS Message content:', message)

    // Send SMS via Clicksend
    console.log('🚀 Sending SMS via Clicksend...')
    console.log('📡 Clicksend request details:', {
      url: `${CLICKSEND_BASE_URL}/sms/send`,
      senderId: CLICKSEND_SENDER_ID,
      to: driverPhone,
      messageLength: message.length
    })

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
            body: message,
            to: driverPhone
          }
        ]
      })
    })

    console.log('📡 Clicksend response status:', clicksendResponse.status)
    console.log('📡 Clicksend response headers:', Object.fromEntries(clicksendResponse.headers.entries()))

    if (!clicksendResponse.ok) {
      const errorData = await clicksendResponse.json()
      console.error('❌ Clicksend API error:', errorData)
      throw new Error(`Clicksend API error: ${clicksendResponse.status}`)
    }

    const clicksendData = await clicksendResponse.json()
    console.log('✅ Clicksend success response:', clicksendData)
    
    // Extract message ID from Clicksend response
    const messageId = clicksendData.data?.messages?.[0]?.message_id || 'unknown'
    console.log('🆔 Clicksend message ID:', messageId)

    // Update order to track SMS sent
    console.log('💾 Updating order with SMS history...')
    await prisma.order.update({
      where: { id },
      data: {
        lastSmsSent: new Date(),
        smsHistory: {
          push: {
            timestamp: new Date(),
            phone: driverPhone,
            messageId: messageId,
            status: 'SUCCESS',
            provider: 'clicksend'
          }
        }
      }
    })

    console.log('✅ SMS process completed successfully')

    return NextResponse.json({
      success: true,
      messageId: messageId,
      status: 'SUCCESS',
      provider: 'clicksend'
    })

  } catch (error) {
    console.error('❌ Error in SMS API:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to send SMS', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function formatOrderSMS(order: any): string {
  console.log('📝 Starting SMS message formatting...')
  
  const lineItems = Array.isArray(order.lineItems) 
    ? order.lineItems 
    : JSON.parse(order.lineItems as string)

  console.log('📦 Line items for SMS:', lineItems)

  const items = lineItems
    .map((item: any) => `${item.quantity}x ${item.title}`)
    .join('\n')

  const address = order.shippingAddress
  const fullAddress = [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip
  ].filter(Boolean).join(', ')

  const deliveryTime = order.deliveryTime || 'TBD'
  const customerPhone = order.customerPhone || 'No phone provided'

  // Filter out delivery date/time information from notes
  let filteredNotes = order.note || 'No special instructions'
  if (filteredNotes.includes('Delivery Date:') || filteredNotes.includes('Delivery Time:')) {
    // Remove everything from "Delivery Date:" onwards
    const deliveryDateIndex = filteredNotes.indexOf('Delivery Date:')
    if (deliveryDateIndex !== -1) {
      filteredNotes = filteredNotes.substring(0, deliveryDateIndex).trim()
    }
    
    // If notes are now empty after filtering, set to default
    if (!filteredNotes) {
      filteredNotes = 'No special instructions'
    }
  }

  const message = `#${order.orderNumber}

${fullAddress}

${order.customerFirstName} ${order.customerLastName} - ${customerPhone}

Delivery: ${deliveryTime}

Items:
${items}

Notes: ${filteredNotes}`

  console.log('📨 Final SMS message length:', message.length)
  return message
} 