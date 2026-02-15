/**
 * Backfill script for canonical scheduling fields
 * 
 * Processes existing orders that are missing:
 * - deliveryDateTime
 * - region
 * - deliveryDateSource
 * 
 * Applies canonicalization logic to populate these fields.
 */

const { PrismaClient } = require('@prisma/client')
const { canonicalizeOrderScheduling } = require('../src/lib/order-canonicalize')

const prisma = new PrismaClient()

const BATCH_SIZE = 500

async function backfillOrderScheduling() {
  console.log('🔄 Starting backfill of order scheduling fields...')
  
  try {
    // Find orders missing canonical scheduling fields
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
      console.log('✅ No orders need backfilling - all canonical fields are populated!')
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
      
      if (batch.length === 0) {
        break
      }
      
      console.log(`📦 Processing batch ${Math.floor(skip / BATCH_SIZE) + 1} (${batch.length} orders)...`)
      
      for (const order of batch) {
        try {
          // Only update fields that are missing (don't overwrite existing good values)
          const updateData = {}
          
          // Apply canonicalization
          const scheduling = canonicalizeOrderScheduling({
            deliveryDate: order.deliveryDate,
            deliveryTime: order.deliveryTime,
            noteAttributes: order.noteAttributes,
            tags: order.tags,
            createdAt: order.createdAt,
            shippingAddress: order.shippingAddress,
            lineItems: order.lineItems,
          })
          
          // Only set fields that are currently null
          if (order.region === null) {
            updateData.region = scheduling.region
          }
          if (order.deliveryDateTime === null) {
            updateData.deliveryDateTime = scheduling.deliveryDateTime
          }
          if (order.deliveryDateSource === null) {
            updateData.deliveryDateSource = scheduling.deliveryDateSource
          }
          // Always update needsSchedulingReview if deliveryDateTime is null (safety check)
          if (order.deliveryDateTime === null || scheduling.needsSchedulingReview) {
            updateData.needsSchedulingReview = scheduling.needsSchedulingReview
          }
          
          // Only update if there's something to update
          if (Object.keys(updateData).length > 0) {
            await prisma.order.update({
              where: { id: order.id },
              data: updateData
            })
            updated++
            if (scheduling.needsSchedulingReview) {
              needsReviewCount++
            }
          }
        } catch (error) {
          console.error(`❌ Error processing order ${order.id}:`, error)
          errors++
        }
        
        processed++
      }
      
      skip += BATCH_SIZE
      
      // Progress update
      if (processed % 1000 === 0) {
        console.log(`📈 Progress: ${processed}/${totalToProcess} processed, ${updated} updated, ${needsReviewCount} need review`)
      }
    }
    
    console.log('\n✅ Backfill complete!')
    console.log(`📊 Summary:`)
    console.log(`   - Total processed: ${processed}`)
    console.log(`   - Updated: ${updated}`)
    console.log(`   - Need review: ${needsReviewCount}`)
    console.log(`   - Errors: ${errors}`)
    
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  backfillOrderScheduling()
    .then(() => {
      console.log('✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

module.exports = { backfillOrderScheduling }
