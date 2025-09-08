#!/usr/bin/env node

/*
  One-off script:
  - Backup ProductWithCustomData ingredients and totalCost to JSON
  - Set ingredients = NULL and totalCost = 0 for all ProductWithCustomData
*/

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('../src/generated/prisma')
const prisma = new PrismaClient()

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(process.cwd(), 'backups')
  const outFile = path.join(outDir, `product-with-custom-data-backup-${timestamp}.json`)

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  console.log('📦 Fetching ProductWithCustomData for backup...')
  const rows = await prisma.productWithCustomData.findMany({
    select: {
      id: true,
      variantId: true,
      shopifySku: true,
      shopifyTitle: true,
      ingredients: true,
      totalCost: true,
      updatedAt: true,
    },
  })

  console.log(`📝 Backing up ${rows.length} rows to ${outFile}`)
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2), 'utf8')

  console.log('🧹 Clearing ingredients and totalCost...')
  const result = await prisma.productWithCustomData.updateMany({
    data: { ingredients: null, totalCost: 0 },
  })

  console.log(`✅ Updated ${result.count} rows.`)
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


