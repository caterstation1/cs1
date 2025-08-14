#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { env } from '../src/env.mjs'

const prisma = new PrismaClient()

// Shopify API configuration
const shopUrl = env.SHOPIFY_SHOP_URL
const accessToken = env.SHOPIFY_ACCESS_TOKEN
const apiVersion = env.SHOPIFY_API_VERSION

if (!shopUrl || !accessToken || !apiVersion) {
  console.error('❌ Missing Shopify credentials:')
  console.error('SHOPIFY_SHOP_URL:', shopUrl ? 'Set' : 'Missing')
  console.error('SHOPIFY_ACCESS_TOKEN:', accessToken ? 'Set' : 'Missing')
  console.error('SHOPIFY_API_VERSION:', apiVersion ? 'Set' : 'Missing')
  process.exit(1)
}

console.log('🚀 Starting bulk fetch of ALL Shopify orders...')
console.log('🔗 Shopify URL:', shopUrl)
console.log('🔑 Access Token:', accessToken ? 'Set' : 'Missing')
console.log('📋 API Version:', apiVersion)

async function fetchAllShopifyOrders() {
  const allOrders = []
  let hasNextPage = true
  let nextPageInfo = null
  let pageCount = 0

  while (hasNextPage) {
    pageCount++
    const url = nextPageInfo 
      ? `https://${shopUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250&page_info=${nextPageInfo}`
      : `https://${shopUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250`

    console.log(`📦 Fetching page ${pageCount}: ${nextPageInfo ? 'next' : 'first'}`)

    try {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const orders = data.orders || []
      
      allOrders.push(...orders)
      console.log(`📄 Page ${pageCount}: Fetched ${orders.length} orders (Total: ${allOrders.length})`)

      // Check for next page
      const linkHeader = response.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>; rel="next"/)
        if (nextMatch) {
          nextPageInfo = nextMatch[1]
          console.log(`📄 Found next page, continuing...`)
        } else {
          hasNextPage = false
        }
      } else {
        hasNextPage = false
      }

      // Add delay between requests
      if (hasNextPage) {
        console.log('⏳ Waiting 100ms before next request...')
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error) {
      console.error(`❌ Error fetching page ${pageCount}:`, error)
      throw error
    }
  }

  console.log(`✅ Fetched ${allOrders.length} total orders from Shopify across ${pageCount} pages`)
  return allOrders
}

async function saveOrdersToDatabase(orders) {
  console.log('💾 Saving orders to Railway database...')
  
  let savedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const order of orders) {
    try {
      // Check if order already exists
      const existingOrder = await prisma.order.findUnique({
        where: { shopifyId: order.id.toString() }
      })

      if (existingOrder) {
        console.log(`⏭️  Skipping existing order #${order.order_number} (${order.id})`)
        skippedCount++
        continue
      }

      // Transform order data
      const orderData = {
        shopifyId: order.id.toString(),
        orderNumber: order.order_number,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        processedAt: order.processed_at ? new Date(order.processed_at) : null,
        cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
        closedAt: order.closed_at ? new Date(order.closed_at) : null,
        totalPrice: parseFloat(order.total_price),
        subtotalPrice: parseFloat(order.subtotal_price),
        totalTax: parseFloat(order.total_tax),
        currency: order.currency,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        tags: order.tags,
        note: order.note,
        customerEmail: order.customer?.email || '',
        customerFirstName: order.customer?.first_name || '',
        customerLastName: order.customer?.last_name || '',
        customerPhone: order.customer?.phone || '',
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        lineItems: order.line_items,
        source: 'shopify',
        hasLocalEdits: false,
        syncedAt: new Date(),
        dbCreatedAt: new Date(),
        dbUpdatedAt: new Date()
      }

      // Save to database
      await prisma.order.create({
        data: orderData
      })

      savedCount++
      if (savedCount % 100 === 0) {
        console.log(`💾 Saved ${savedCount} orders so far...`)
      }

    } catch (error) {
      console.error(`❌ Error saving order #${order.order_number}:`, error.message)
      errorCount++
    }
  }

  console.log(`✅ Database save completed:`)
  console.log(`   📥 Saved: ${savedCount} orders`)
  console.log(`   ⏭️  Skipped: ${skippedCount} orders (already exist)`)
  console.log(`   ❌ Errors: ${errorCount} orders`)
  
  return { savedCount, skippedCount, errorCount }
}

async function main() {
  try {
    console.log('🔗 Connecting to Railway database...')
    await prisma.$connect()
    console.log('✅ Connected to database')

    const startTime = Date.now()
    
    // Fetch all orders from Shopify
    const orders = await fetchAllShopifyOrders()
    
    // Save to database
    const saveResults = await saveOrdersToDatabase(orders)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log('\n🎉 BULK FETCH COMPLETED!')
    console.log(`⏱️  Total duration: ${duration}ms (${Math.round(duration / 1000)}s)`)
    console.log(`📦 Total orders fetched: ${orders.length}`)
    console.log(`💾 Orders saved to database: ${saveResults.savedCount}`)
    console.log(`⏭️  Orders skipped (already exist): ${saveResults.skippedCount}`)
    console.log(`❌ Orders with errors: ${saveResults.errorCount}`)

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    console.log('🔌 Disconnected from database')
  }
}

// Run the script
main()
