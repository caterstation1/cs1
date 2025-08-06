import { prisma } from '@/lib/prisma'

export interface ProductRule {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  priority: number
  matchPattern: string
  matchType: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex'
  setDisplayName?: string | null
  setMeat1?: string | null
  setMeat2?: string | null
  setTimer1?: number | null
  setTimer2?: number | null
  setOption1?: string | null
  setOption2?: string | null
  setServeware?: boolean | null
  setIngredients?: any | null  // Array of ingredients
  setTotalCost?: number | null
}

export interface ProductCustomData {
  displayName?: string
  meat1?: string
  meat2?: string
  timer1?: number
  timer2?: number
  option1?: string
  option2?: string
  serveware?: boolean
  ingredients?: any[]  // Array of ingredients
  totalCost?: number
}

/**
 * Applies product rules to a product title and variant title and returns suggested custom data
 */
export async function applyProductRules(productTitle: string, variantTitle?: string): Promise<ProductCustomData> {
  try {
    console.log(`🔍 Applying rules to product: "${productTitle}"${variantTitle ? ` (variant: "${variantTitle}")` : ''}`);
    
    // Get all active rules, ordered by priority (highest first)
    const rules = await prisma.productRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    })

    console.log(`📋 Found ${rules.length} active rules to check`);

    const result: ProductCustomData = {}

    // Apply each rule that matches either product title or variant title
    for (const rule of rules) {
      console.log(`\n🔎 Checking rule: "${rule.name}" (pattern: "${rule.matchPattern}", type: ${rule.matchType})`);
      
      const matchesProductTitle = matchesRule(productTitle, rule as ProductRule)
      const matchesVariantTitle = variantTitle ? matchesRule(variantTitle, rule as ProductRule) : false
      
      console.log(`   Product title match: ${matchesProductTitle}`);
      if (variantTitle) {
        console.log(`   Variant title match: ${matchesVariantTitle}`);
      }
      
      if (matchesProductTitle || matchesVariantTitle) {
        console.log(`✅ Rule "${rule.name}" MATCHED! Applying settings...`);
        
        // Apply rule actions (only if not already set)
        if (rule.setDisplayName && result.displayName === undefined) {
          result.displayName = rule.setDisplayName
          console.log(`   📝 Set displayName: "${rule.setDisplayName}"`);
        }
        if (rule.setMeat1 && result.meat1 === undefined) {
          result.meat1 = rule.setMeat1
          console.log(`   🥩 Set meat1: "${rule.setMeat1}"`);
        }
        if (rule.setMeat2 && result.meat2 === undefined) {
          result.meat2 = rule.setMeat2
          console.log(`   🥩 Set meat2: "${rule.setMeat2}"`);
        }
        if (rule.setTimer1 !== null && rule.setTimer1 !== undefined && result.timer1 === undefined) {
          result.timer1 = rule.setTimer1
          console.log(`   ⏰ Set timer1: ${rule.setTimer1}`);
        }
        if (rule.setTimer2 !== null && rule.setTimer2 !== undefined && result.timer2 === undefined) {
          result.timer2 = rule.setTimer2
          console.log(`   ⏰ Set timer2: ${rule.setTimer2}`);
        }
        if (rule.setOption1 && result.option1 === undefined) {
          result.option1 = rule.setOption1
          console.log(`   ⚙️ Set option1: "${rule.setOption1}"`);
        }
        if (rule.setOption2 && result.option2 === undefined) {
          result.option2 = rule.setOption2
          console.log(`   ⚙️ Set option2: "${rule.setOption2}"`);
        }
        if (rule.setServeware !== null && rule.setServeware !== undefined && result.serveware === undefined) {
          result.serveware = rule.setServeware
          console.log(`   🍽️ Set serveware: ${rule.setServeware}`);
        }
        if (rule.setIngredients && result.ingredients === undefined) {
          result.ingredients = Array.isArray(rule.setIngredients) ? rule.setIngredients : []
          console.log(`   🧀 Set ingredients:`, rule.setIngredients);
          console.log(`   🧀 Ingredients type:`, typeof rule.setIngredients);
          console.log(`   🧀 Ingredients is array:`, Array.isArray(rule.setIngredients));
        }
        if (rule.setTotalCost !== null && rule.setTotalCost !== undefined && result.totalCost === undefined) {
          result.totalCost = rule.setTotalCost
          console.log(`   💰 Set totalCost: ${rule.setTotalCost}`);
        }
      } else {
        console.log(`❌ Rule "${rule.name}" did not match`);
      }
    }

    console.log(`\n📊 Final result:`, result);
    return result
  } catch (error) {
    console.error('❌ Error applying product rules:', error)
    return {}
  }
}

/**
 * Checks if a variant title matches a rule
 */
function matchesRule(variantTitle: string, rule: ProductRule): boolean {
  const title = variantTitle.toLowerCase()
  const pattern = rule.matchPattern.toLowerCase()

  switch (rule.matchType) {
    case 'contains':
      return title.includes(pattern)
    case 'startsWith':
      return title.startsWith(pattern)
    case 'endsWith':
      return title.endsWith(pattern)
    case 'exact':
      return title === pattern
    case 'regex':
      try {
        const regex = new RegExp(pattern, 'i')
        return regex.test(variantTitle)
      } catch (error) {
        console.error('Invalid regex pattern:', pattern, error)
        return false
      }
    default:
      return false
  }
}

/**
 * Applies rules to all products that don't have custom data
 */
export async function applyRulesToAllProducts(): Promise<{ updated: number; errors: number }> {
  return applyRulesToMatchingProducts();
}

export async function applyRulesToMatchingProducts(matchPattern?: string): Promise<{ updated: number; errors: number }> {
  try {
    console.log('🚀 Starting applyRulesToAllProducts...');
    
    // Build where clause based on whether we have a specific pattern to match
    let whereClause: any = {};

    if (matchPattern) {
      // If we have a specific pattern, only match products with that pattern
      whereClause = {
        OR: [
          { shopifyName: { contains: matchPattern, mode: 'insensitive' } },
          { shopifyTitle: { contains: matchPattern, mode: 'insensitive' } }
        ]
      };
    } else {
      // If no pattern, apply to products that need rule application
      whereClause = {
        OR: [
          { displayName: null },
          { meat1: null },
          { meat2: null },
          { timer1: null },
          { timer2: null },
          { option1: null },
          { option2: null },
          { serveware: false },
          { totalCost: 0 }
        ]
      };
    }

    // Get total count first
    const totalCount = await prisma.productWithCustomData.count({
      where: whereClause
    })

    console.log(`📦 Found ${totalCount} products that need rule application${matchPattern ? ` matching "${matchPattern}"` : ''}`);
    console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));

    let updated = 0
    let errors = 0
    const batchSize = 10 // Much smaller batches to prevent timeouts
    let skip = 0
    const totalBatches = Math.ceil(totalCount / batchSize)

    while (skip < totalCount) {
      const currentBatch = Math.floor(skip / batchSize) + 1
      console.log(`\n🔄 Processing batch ${currentBatch}/${totalBatches} (${skip + 1}-${Math.min(skip + batchSize, totalCount)}) - Progress: ${Math.round((currentBatch / totalBatches) * 100)}%`);
      
      // Get batch of products
      const products = await prisma.productWithCustomData.findMany({
        where: whereClause,
        skip,
        take: batchSize,
        select: {
          id: true,
          shopifyName: true,
          shopifyTitle: true,
          displayName: true,
          meat1: true,
          meat2: true,
          timer1: true,
          timer2: true,
          option1: true,
          option2: true,
          serveware: true,
          totalCost: true,
          ingredients: true
        }
      })

      for (const product of products) {
        try {
          // Check both shopifyName and shopifyTitle for rule matching
          const suggestedDataFromName = await applyProductRules(product.shopifyName)
          const suggestedDataFromTitle = await applyProductRules(product.shopifyTitle)
          
          // Merge the suggested data, prioritizing shopifyName matches
          const suggestedData = { ...suggestedDataFromTitle, ...suggestedDataFromName }
          
          // Only update if we have new data to set
          const hasNewData = Object.values(suggestedData).some(value => value !== undefined)
          
          if (hasNewData) {
            console.log(`✅ Updating product "${product.shopifyName}" with new data`);
            
            const updateData: any = {
              displayName: suggestedData.displayName ?? product.displayName,
              meat1: suggestedData.meat1 ?? product.meat1,
              meat2: suggestedData.meat2 ?? product.meat2,
              timer1: suggestedData.timer1 ?? product.timer1,
              timer2: suggestedData.timer2 ?? product.timer2,
              option1: suggestedData.option1 ?? product.option1,
              option2: suggestedData.option2 ?? product.option2,
              serveware: suggestedData.serveware ?? product.serveware,
              totalCost: suggestedData.totalCost ?? product.totalCost,
            }

            // Handle ingredients separately to avoid type issues
            if (suggestedData.ingredients !== undefined) {
              updateData.ingredients = suggestedData.ingredients
              console.log(`   🧀 Updating ingredients in database:`, suggestedData.ingredients);
              console.log(`   🧀 Ingredients type for DB:`, typeof suggestedData.ingredients);
            } else {
              updateData.ingredients = product.ingredients
            }

            await prisma.productWithCustomData.update({
              where: { id: product.id },
              data: updateData
            })
            updated++
          }
        } catch (error) {
          console.error(`❌ Error applying rules to product ${product.id}:`, error)
          errors++
        }
      }

      skip += batchSize
      
      // Add a small delay between batches to prevent overwhelming the database
      if (skip < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`\n📊 Rule application complete: ${updated} updated, ${errors} errors`);
    return { updated, errors }
  } catch (error) {
    console.error('❌ Error applying rules to all products:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      matchPattern
    })
    return { updated: 0, errors: 1 }
  }
}

/**
 * Seeds initial rules based on common patterns
 */
export async function seedInitialRules(): Promise<void> {
  const initialRules = [
    {
      name: 'Yes Serveware',
      description: 'Sets serveware to true when variant contains "Yes Serveware"',
      matchPattern: 'Yes Serveware',
      matchType: 'contains' as const,
      setServeware: true,
      priority: 10
    },
    {
      name: 'No Serveware',
      description: 'Sets serveware to false when variant contains "No Serveware"',
      matchPattern: 'No Serveware',
      matchType: 'contains' as const,
      setServeware: false,
      priority: 10
    },
    {
      name: 'Beef Meat',
      description: 'Sets meat1 to "B" and timer1 to 60 when variant contains "Beef"',
      matchPattern: 'Beef',
      matchType: 'contains' as const,
      setMeat1: 'B',
      setTimer1: 60,
      priority: 5
    },
    {
      name: 'Chicken Meat',
      description: 'Sets meat1 to "C" and timer1 to 45 when variant contains "Chicken"',
      matchPattern: 'Chicken',
      matchType: 'contains' as const,
      setMeat1: 'C',
      setTimer1: 45,
      priority: 5
    },
    {
      name: 'Pork Meat',
      description: 'Sets meat1 to "P" and timer1 to 50 when variant contains "Pork"',
      matchPattern: 'Pork',
      matchType: 'contains' as const,
      setMeat1: 'P',
      setTimer1: 50,
      priority: 5
    },
    {
      name: 'Lamb Meat',
      description: 'Sets meat1 to "L" and timer1 to 55 when variant contains "Lamb"',
      matchPattern: 'Lamb',
      matchType: 'contains' as const,
      setMeat1: 'L',
      setTimer1: 55,
      priority: 5
    },
    {
      name: 'Fish Meat',
      description: 'Sets meat1 to "F" and timer1 to 30 when variant contains "Fish"',
      matchPattern: 'Fish',
      matchType: 'contains' as const,
      setMeat1: 'F',
      setTimer1: 30,
      priority: 5
    },
    {
      name: 'Tofu Meat',
      description: 'Sets meat1 to "T" and timer1 to 20 when variant contains "Tofu"',
      matchPattern: 'Tofu',
      matchType: 'contains' as const,
      setMeat1: 'T',
      setTimer1: 20,
      priority: 5
    },
    {
      name: 'Vegetarian',
      description: 'Sets meat1 to "V" when variant contains "Vegetarian"',
      matchPattern: 'Vegetarian',
      matchType: 'contains' as const,
      setMeat1: 'V',
      priority: 5
    },
    {
      name: 'Vegan',
      description: 'Sets meat1 to "VG" when variant contains "Vegan"',
      matchPattern: 'Vegan',
      matchType: 'contains' as const,
      setMeat1: 'VG',
      priority: 5
    }
  ]

  for (const rule of initialRules) {
    // Check if rule already exists
    const existingRule = await prisma.productRule.findFirst({
      where: { name: rule.name }
    })

    if (existingRule) {
      // Update existing rule
      await prisma.productRule.update({
        where: { id: existingRule.id },
        data: rule
      })
    } else {
      // Create new rule
      await prisma.productRule.create({
        data: rule
      })
    }
  }

  console.log('Initial product rules seeded successfully')
} 