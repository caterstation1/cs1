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
    // TEMPORARY: Auth disabled for backfill - remove after completion
    // TODO: Re-enable auth or delete this endpoint after backfill
    console.log('🔄 Backfill endpoint called')
    
    const { searchParams } = new URL(request.url)
    const batchNumber = parseInt(searchParams.get('batch') || '1')
    const maxBatches = parseInt(searchParams.get('maxBatches') || '1') // Process 1 batch per call to avoid timeout
    
    console.log(`🔄 Starting backfill batch ${batchNumber}...`)
    
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
        errors: 0,
        totalRemaining: 0
      })
    }
    
    let processed = 0
    let updated = 0
    let needsReviewCount = 0
    let errors = 0
    const skip = (batchNumber - 1) * BATCH_SIZE
    
    // Process ONE batch only (to avoid timeout)
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
      return NextResponse.json({
        success: true,
        message: 'All batches processed!',
        processed: 0,
        updated: 0,
        needsReview: 0,
        errors: 0,
        totalRemaining: 0
      })
    }
    
    console.log(`📦 Processing batch ${batchNumber} (${batch.length} orders)...`)
    
    // Process this batch
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
      
    const totalRemaining = Math.max(0, totalToProcess - (skip + batch.length))
    const hasMore = totalRemaining > 0
    
    const result = {
      success: true,
      message: hasMore ? `Batch ${batchNumber} complete. More batches remaining.` : 'All batches complete!',
      batch: batchNumber,
      summary: {
        batchProcessed: processed,
        batchUpdated: updated,
        batchNeedsReview: needsReviewCount,
        batchErrors: errors
      },
      total: {
        totalToProcess,
        totalProcessed: skip + batch.length,
        totalRemaining,
        hasMore
      },
      nextBatch: hasMore ? `/api/admin/backfill-scheduling?batch=${batchNumber + 1}` : null
    }
    
    console.log(`✅ Batch ${batchNumber} complete!`, result.summary)
    
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
