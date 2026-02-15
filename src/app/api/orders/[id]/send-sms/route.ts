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
    const { driverPhone, message: overrideMessage } = await request.json()

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
    })

    // Format the SMS message (prefer client-provided override)
    console.log('📝 Formatting SMS message...')
    const message = typeof overrideMessage === 'string' && overrideMessage.trim().length > 0
      ? overrideMessage
      : formatOrderSMS(order)
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

    const responseData = await clicksendResponse.json()
    console.log('✅ SMS sent successfully:', responseData)

    // Update order with SMS history
    const smsHistory = order.smsHistory ? JSON.parse(JSON.stringify(order.smsHistory)) : []
    smsHistory.push({
      timestamp: new Date().toISOString(),
      phone: driverPhone,
      message: message,
      status: 'sent'
    })

    await prisma.order.update({
      where: { id },
      data: {
        lastSmsSent: new Date(),
        smsHistory: smsHistory
      }
    })

    console.log('✅ Order updated with SMS history')

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      orderId: id,
      driverPhone: driverPhone,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error sending SMS:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function formatOrderSMS(order: any): string {
  const customerName = `${order.customerFirstName} ${order.customerLastName}`
  const orderNumber = order.orderNumber
  const deliveryTime = order.deliveryTime || 'TBD'
  const deliveryDate = order.deliveryDate || 'TBD'
  
  // Format address if available
  let address = 'Address TBD'
  if (order.shippingAddress) {
    const shipping = order.shippingAddress
    address = `${shipping.address1 || ''} ${shipping.city || ''} ${shipping.zip || ''}`.trim()
  }
  
  return `CaterStation Order #${orderNumber}
Customer: ${customerName}
Delivery: ${deliveryDate} at ${deliveryTime}
Address: ${address}
Total: $${order.totalPrice}
Please confirm delivery time and address.`
}
