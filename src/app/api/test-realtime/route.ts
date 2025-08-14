import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'update-test-order') {
      // Find a test order and update it to simulate real-time changes
      const testOrder = await prisma.order.findFirst({
        where: {
          orderNumber: {
            gte: 1000 // Assuming test orders have high order numbers
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      
      if (testOrder) {
        // Update the order with a timestamp to simulate a change
        const updatedOrder = await prisma.order.update({
          where: { id: testOrder.id },
          data: {
            note: `Test update at ${new Date().toLocaleTimeString()}`,
            dbUpdatedAt: new Date()
          }
        })
        
        return NextResponse.json({
          success: true,
          message: 'Test order updated',
          order: updatedOrder
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'No test order found'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Realtime test endpoint ready',
      actions: ['update-test-order']
    })
    
  } catch (error) {
    console.error('Error in realtime test endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to process realtime test' },
      { status: 500 }
    )
  }
}
