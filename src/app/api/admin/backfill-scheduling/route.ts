/**
 * Temporary admin endpoint to run the backfill script
 * 
 * This allows running the backfill from production without local npm issues.
 * Should be removed or secured after backfill is complete.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canonicalizeOrderScheduling } from '@/lib/order-canonicalize'

const BATCH_SIZE = 500

export async function POST(request: Request) {
  try {
    // Simple auth check - you can add proper auth later
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.ADMIN_SECRET || 'temp-secret-change-me'
    
    // Debug: log what we're comparing (remove in production)
    console.log('🔐 Auth check:', {
      hasHeader: !!authHeader,
      headerValue: authHeader?.substring(0, 20) + '...',
      expectedSecret: expectedSecret.substring(0, 20) + '...'
    })
    
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        hint: 'Expected: Bearer ' + expectedSecret.substring(0, 10) + '...'
      }, { status: 401 })
    }

    console.log('🔄 Starting backfill of order scheduling fields...')
    
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
      return NextResponse.json({
        success: true,
        message: 'No orders need backfilling - all canonical fields are populated!',
        processed: 0,
        updated: 0,
        needsReview: 0,
        errors: 0
      })
    }
    
    let processed = 0
    let updated = 0
    let needsReviewCount = 0
    let errors = 0
    let skip = 0
    
    // Process in batches
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
          const updateData: any = {}
          
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
    
    const result = {
      success: true,
      message: 'Backfill complete!',
      summary: {
        totalProcessed: processed,
        updated,
        needsReview: needsReviewCount,
        errors
      }
    }
    
    console.log('✅ Backfill complete!', result.summary)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to run backfill',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
