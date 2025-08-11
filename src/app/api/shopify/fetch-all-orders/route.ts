import { NextRequest, NextResponse } from 'next/server'
import { fetchAllShopifyOrders } from '@/lib/shopify-client'

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting bulk fetch of all Shopify orders...')
    
    const startTime = Date.now()
    const orders = await fetchAllShopifyOrders()
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`✅ Bulk fetch completed: ${orders.length} orders in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${orders.length} orders from Shopify`,
      count: orders.length,
      duration: `${duration}ms`,
      orders: orders
    })
    
  } catch (error) {
    console.error('❌ Error fetching all Shopify orders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to fetch orders from Shopify'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { saveToDatabase = false } = body
    
    console.log('🚀 Starting bulk fetch of all Shopify orders...')
    console.log('💾 Save to database:', saveToDatabase)
    
    const startTime = Date.now()
    const orders = await fetchAllShopifyOrders()
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`✅ Bulk fetch completed: ${orders.length} orders in ${duration}ms`)
    
    let result = {
      success: true,
      message: `Successfully fetched ${orders.length} orders from Shopify`,
      count: orders.length,
      duration: `${duration}ms`,
      orders: orders
    }
    
    // TODO: If saveToDatabase is true, save orders to database
    if (saveToDatabase) {
      console.log('💾 Database save requested but not implemented yet')
      result.message += ' (Database save not implemented yet)'
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ Error fetching all Shopify orders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to fetch orders from Shopify'
      },
      { status: 500 }
    )
  }
}
