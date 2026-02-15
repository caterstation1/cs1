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

import { PrismaClient } from '@prisma/client'
import { canonicalizeOrderScheduling } from '../src/lib/order-canonicalize'

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
          // Apply canonicalization
          const scheduling = canonicalizeOrderScheduling({
            deliveryDate: order.deliveryDate,
            deliveryTime: order.deliveryTime,
            noteAttributes: order.noteAttributes as any,
            tags: order.tags,
            createdAt: order.createdAt,
            shippingAddress: order.shippingAddress as any,
            lineItems: order.lineItems as any,
          })
          
          // Update order
          await prisma.order.update({
            where: { id: order.id },
            data: {
              region: scheduling.region,
              deliveryDateTime: scheduling.deliveryDateTime,
              deliveryDateSource: scheduling.deliveryDateSource,
              needsSchedulingReview: scheduling.needsSchedulingReview,
            }
          })
          
          updated++
          if (scheduling.needsSchedulingReview) {
            needsReviewCount++
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

export { backfillOrderScheduling }
