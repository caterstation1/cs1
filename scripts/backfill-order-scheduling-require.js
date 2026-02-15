// Temporary wrapper to handle ES module imports
const path = require('path')
const { PrismaClient } = require('@prisma/client')

// Use dynamic import for ES modules
async function run() {
  const { canonicalizeOrderScheduling } = await import('../src/lib/order-canonicalize.ts')
  const prisma = new PrismaClient()
  const BATCH_SIZE = 500

  console.log('🔄 Starting backfill of order scheduling fields...')
  
  try {
    const totalToProcess = await prisma.order.count({
      where: {
        OR: [
          { deliveryDateTime: null },
          { region: null },
          { deliveryDateSource: null },
        ]
      }
    })
    
    console.log(`📊 Found ${totalToProcess} orders to process`)
    
    if (totalToProcess === 0) {
      console.log('✅ No orders need backfilling!')
      return
    }
    
    let processed = 0
    let updated = 0
    let needsReviewCount = 0
    let errors = 0
    let skip = 0
    
    while (true) {
      const batch = await prisma.order.findMany({
        where: {
          OR: [
            { deliveryDateTime: null },
            { region: null },
            { deliveryDateSource: null },
          ]
        },
        take: BATCH_SIZE,
        skip,
        orderBy: { createdAt: 'desc' }
      })
      
      if (batch.length === 0) break
      
      console.log(`📦 Processing batch ${Math.floor(skip / BATCH_SIZE) + 1} (${batch.length} orders)...`)
      
      for (const order of batch) {
        try {
          const updateData = {}
          const scheduling = canonicalizeOrderScheduling({
            deliveryDate: order.deliveryDate,
            deliveryTime: order.deliveryTime,
            noteAttributes: order.noteAttributes,
            tags: order.tags,
            createdAt: order.createdAt,
            shippingAddress: order.shippingAddress,
            lineItems: order.lineItems,
          })
          
          if (order.region === null) updateData.region = scheduling.region
          if (order.deliveryDateTime === null) updateData.deliveryDateTime = scheduling.deliveryDateTime
          if (order.deliveryDateSource === null) updateData.deliveryDateSource = scheduling.deliveryDateSource
          if (order.deliveryDateTime === null || scheduling.needsSchedulingReview) {
            updateData.needsSchedulingReview = scheduling.needsSchedulingReview
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.order.update({ where: { id: order.id }, data: updateData })
            updated++
            if (scheduling.needsSchedulingReview) needsReviewCount++
          }
        } catch (error) {
          console.error(`❌ Error processing order ${order.id}:`, error.message)
          errors++
        }
        processed++
      }
      
      skip += BATCH_SIZE
      if (processed % 1000 === 0) {
        console.log(`📈 Progress: ${processed}/${totalToProcess} processed, ${updated} updated, ${needsReviewCount} need review`)
      }
    }
    
    console.log('\n✅ Backfill complete!')
    console.log(`📊 Summary: ${processed} processed, ${updated} updated, ${needsReviewCount} need review, ${errors} errors`)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
