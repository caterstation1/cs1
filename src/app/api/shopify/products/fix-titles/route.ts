import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function POST() {
  try {
    console.log('🔧 Fixing product titles...');
    
    // Get only a small number of products to avoid timeout
    const products = await prisma.productWithCustomData.findMany({
      where: {
        shopifyName: {
          contains: '/'
        }
      },
      take: 10 // Only process 10 products at a time
    });
    
    console.log(`📦 Found ${products.length} products to fix`);

    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Extract base product name from the variant title
        const variantTitle = product.shopifyName;
        
        // Simple extraction - look for the first part that doesn't start with common option words
        let baseProductName = variantTitle;
        
        if (variantTitle.includes(' / ')) {
          const parts = variantTitle.split(' / ');
          
          // Find the first part that looks like a product name
          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.startsWith('Yes ') && 
                !trimmed.startsWith('No ') && 
                !trimmed.startsWith('GF ') &&
                !trimmed.startsWith('Vege ') &&
                !trimmed.startsWith('Serveware') &&
                !trimmed.startsWith('Dogs') &&
                !trimmed.startsWith('rolls') &&
                !trimmed.startsWith('Aioli') &&
                !trimmed.startsWith('Pâté') &&
                !trimmed.startsWith('Crispy') &&
                !trimmed.startsWith('Chilli') &&
                !trimmed.startsWith('Sweet') &&
                !trimmed.startsWith('Lemon') &&
                !trimmed.startsWith('Southern') &&
                !trimmed.startsWith('Roasted') &&
                !trimmed.startsWith('Glazed') &&
                !trimmed.startsWith('Pulled') &&
                !trimmed.startsWith('Beef') &&
                !trimmed.startsWith('Chicken') &&
                !trimmed.startsWith('Lamb') &&
                !trimmed.startsWith('Pork') &&
                !trimmed.startsWith('Tofu') &&
                !trimmed.startsWith('($') &&
                !trimmed.includes('(DF)') &&
                !trimmed.includes('(GF)') &&
                !trimmed.includes('(H)') &&
                !trimmed.includes('(V*)') &&
                !trimmed.includes('(Vegan)')) {
              baseProductName = trimmed;
              break;
            }
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