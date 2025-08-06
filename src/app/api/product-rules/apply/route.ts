import { NextRequest, NextResponse } from 'next/server'
import { seedInitialRules, applyRulesToAllProducts, applyRulesToMatchingProducts, applyProductRules } from '@/lib/product-rules-engine'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 PRODUCT RULES APPLY ENDPOINT CALLED - DEBUG VERSION');
    
    const body = await request.json()
    const { action, variantTitle, productTitle, matchPattern } = body
    
    console.log('📝 Request data:', { action, variantTitle, productTitle, matchPattern });

    if (action === 'seed') {
      await seedInitialRules()
      return NextResponse.json({ 
        success: true, 
        message: 'Initial rules seeded successfully' 
      })
    }

    if (action === 'apply-all') {
      const result = await applyRulesToAllProducts()
      return NextResponse.json({ 
        success: true, 
        message: `Applied rules to ${result.updated} products`,
        result 
      })
    }

    if (action === 'apply-matching') {
      console.log('🎯 APPLY-MATCHING ACTION DETECTED');
      console.log('🔍 Match pattern:', matchPattern);
      const result = await applyRulesToMatchingProducts(matchPattern)
      return NextResponse.json({ 
        success: true, 
        message: `Applied rules to ${result.updated} products matching "${matchPattern}"`,
        result 
      })
    }

    if (action === 'test' && (variantTitle || productTitle)) {
      const suggestedData = await applyProductRules(productTitle || variantTitle, variantTitle)
      return NextResponse.json({ 
        success: true, 
        productTitle: productTitle || variantTitle,
        variantTitle,
        suggestedData 
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "seed", "apply-all", or "test" with productTitle or variantTitle' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in product rules action:', error)
    return NextResponse.json(
      { error: 'Failed to execute product rules action' },
      { status: 500 }
    )
  }
} 