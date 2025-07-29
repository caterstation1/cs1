import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function POST() {
  try {
    console.log('🔧 Fixing product titles...');
    
    // Get all products that need fixing
    const products = await prisma.productWithCustomData.findMany({
      where: {
        shopifyName: {
          contains: '/'
        }
      }
    });
    
    console.log(`📦 Found ${products.length} products that need title fixing`);

    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Extract base product name from the variant title
        // Example: "No Serveware / Yes Vege Dogs / Yes GF rolls" -> "Taco Kit 10 - 15"
        const variantTitle = product.shopifyName;
        
        // Look for patterns that indicate this is a variant description
        // We'll try to extract the base product name by looking for common patterns
        let baseProductName = variantTitle;
        
        // If it contains multiple options separated by "/", it's likely a variant
        if (variantTitle.includes(' / ')) {
          // Try to extract the base product name by removing common option patterns
          const parts = variantTitle.split(' / ');
          
          // Look for parts that don't start with common option words
          const baseParts = parts.filter(part => {
            const trimmed = part.trim();
            return !trimmed.startsWith('Yes ') && 
                   !trimmed.startsWith('No ') && 
                   !trimmed.startsWith('GF ') &&
                   !trimmed.startsWith('Vege ') &&
                   !trimmed.startsWith('Serveware') &&
                   !trimmed.startsWith('Dogs') &&
                   !trimmed.startsWith('rolls');
          });
          
          if (baseParts.length > 0) {
            baseProductName = baseParts.join(' / ');
          } else {
            // If we can't extract, use the first part as base name
            baseProductName = parts[0].trim();
          }
        }
        
        // Update the product with the corrected titles
        await prisma.productWithCustomData.update({
          where: {
            id: product.id
          },
          data: {
            shopifyTitle: baseProductName,
            displayName: baseProductName
          }
        });

        console.log(`✅ Updated product: ${product.shopifyName} -> ${baseProductName}`);
        updated++;
        
      } catch (error) {
        console.error(`❌ Error updating product ${product.id}:`, error);
        errors++;
      }
    }

    console.log(`🎉 Title fix completed: ${updated} updated, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Product titles fixed',
      updated,
      errors,
      total: products.length
    });

  } catch (error) {
    console.error('❌ Error fixing product titles:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix product titles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 