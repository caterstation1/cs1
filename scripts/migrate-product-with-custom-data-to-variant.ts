/**
 * Migration script: ProductWithCustomData → ProductVariant
 * 
 * This script migrates all data from the legacy ProductWithCustomData table
 * to the new ProductVariant table, merging data intelligently.
 * 
 * Run with: npx tsx scripts/migrate-product-with-custom-data-to-variant.ts
 */

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const BATCH_SIZE = 100

interface MigrationStats {
  total: number
  matched: number
  updated: number
  created: number
  orphaned: number
  errors: number
}

async function migrateProductWithCustomDataToVariant() {
  console.log('🔄 Starting migration: ProductWithCustomData → ProductVariant\n')

  const stats: MigrationStats = {
    total: 0,
    matched: 0,
    updated: 0,
    created: 0,
    orphaned: 0,
    errors: 0
  }

  try {
    // Get total count
    stats.total = await prisma.productWithCustomData.count()
    console.log(`📊 Found ${stats.total} records in ProductWithCustomData\n`)

    if (stats.total === 0) {
      console.log('✅ No records to migrate!')
      return stats
    }

    let skip = 0
    let batchNum = 0

    while (true) {
      batchNum++
      const batch = await prisma.productWithCustomData.findMany({
        skip,
        take: BATCH_SIZE,
        orderBy: { updatedAt: 'desc' }
      })

      if (batch.length === 0) {
        break
      }

      console.log(`\n📦 Processing batch ${batchNum} (${skip + 1}-${skip + batch.length} of ${stats.total})`)

      for (const legacy of batch) {
        try {
          const variantId = String(legacy.variantId)

          // Find matching ProductVariant
          const variant = await prisma.productVariant.findUnique({
            where: { variantId },
            include: {
              product: {
                select: {
                  id: true,
                  shopifyProductId: true
                }
              }
            }
          })

          if (!variant) {
            // Orphaned record - no matching variant exists
            console.log(`  ⚠️  Orphaned record: variantId ${variantId} (${legacy.shopifyName || 'unknown'})`)
            stats.orphaned++
            continue
          }

          stats.matched++

          // Merge data: prefer ProductVariant if it has data, otherwise use legacy
          const updateData: any = {}

          // Only update fields that are missing in ProductVariant or if legacy has newer data
          // For most fields, prefer ProductVariant (newer architecture)
          // But copy legacy data if ProductVariant is empty/null

          if (!variant.displayName && legacy.displayName) {
            updateData.displayName = legacy.displayName
          }

          if (!variant.meat1 && legacy.meat1) {
            updateData.meat1 = legacy.meat1
          }
          if (!variant.meat2 && legacy.meat2) {
            updateData.meat2 = legacy.meat2
          }

          if (variant.timer1 == null && legacy.timer1 != null) {
            updateData.timer1 = legacy.timer1
          }
          if (variant.timer2 == null && legacy.timer2 != null) {
            updateData.timer2 = legacy.timer2
          }

          if (!variant.option1 && legacy.option1) {
            updateData.option1 = legacy.option1
          }
          if (!variant.option2 && legacy.option2) {
            updateData.option2 = legacy.option2
          }

          // Serveware: prefer legacy if ProductVariant is false and legacy is true
          if (!variant.serveware && legacy.serveware) {
            updateData.serveware = legacy.serveware
          }

          // Ingredients: prefer legacy if ProductVariant is null/empty
          if ((!variant.ingredients || (Array.isArray(variant.ingredients) && variant.ingredients.length === 0)) && legacy.ingredients) {
            updateData.ingredients = legacy.ingredients
          }

          // TotalCost: prefer legacy if ProductVariant is 0 or null
          if ((!variant.totalCost || variant.totalCost === 0) && legacy.totalCost && legacy.totalCost > 0) {
            updateData.totalCost = legacy.totalCost
          }

          // Only update if we have data to merge
          if (Object.keys(updateData).length > 0) {
            await prisma.productVariant.update({
              where: { variantId },
              data: updateData
            })
            stats.updated++
            console.log(`  ✅ Updated variant ${variantId}: ${Object.keys(updateData).join(', ')}`)
          } else {
            // Variant already has all the data, no update needed
            console.log(`  ✓  Variant ${variantId} already up-to-date`)
          }

        } catch (error) {
          console.error(`  ❌ Error processing variantId ${legacy.variantId}:`, error)
          stats.errors++
        }
      }

      skip += BATCH_SIZE

      // Progress update
      const progress = Math.round((skip / stats.total) * 100)
      console.log(`  📈 Progress: ${progress}%`)
    }

    console.log('\n✅ Migration complete!\n')
    console.log('📊 Summary:')
    console.log(`   - Total records: ${stats.total}`)
    console.log(`   - Matched variants: ${stats.matched}`)
    console.log(`   - Updated variants: ${stats.updated}`)
    console.log(`   - Orphaned records: ${stats.orphaned}`)
    console.log(`   - Errors: ${stats.errors}`)

    if (stats.orphaned > 0) {
      console.log(`\n⚠️  Warning: ${stats.orphaned} orphaned records found (no matching ProductVariant exists)`)
      console.log('   These records will remain in ProductWithCustomData but won\'t be migrated.')
    }

    return stats

  } catch (error) {
    console.error('❌ Fatal error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProductWithCustomDataToVariant()
    .then((stats) => {
      console.log('\n✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export { migrateProductWithCustomDataToVariant }
