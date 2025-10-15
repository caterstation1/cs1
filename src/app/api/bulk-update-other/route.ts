import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const { otherItems } = await request.json()

    if (!Array.isArray(otherItems)) {
      return NextResponse.json(
        { error: 'Other items must be an array' },
        { status: 400 }
      )
    }

    const results = {
      updated: 0,
      created: 0,
      errors: 0,
      errorsList: [] as any[]
    }

    for (const item of otherItems) {
      try {
        const {
          id,
          name,
          description,
          supplier,
          cost,
          prepCategory,
          prepCategories
        } = item

        if (!name || name.trim() === '') {
          results.errors++
          results.errorsList.push({ id, error: 'Name is required' })
          continue
        }

        // Handle prep categories: support both single and multiple
        let prepCategorySingle: string | null = null
        let prepCategoriesMultiple: string[] | null = null
        
        if (prepCategories && Array.isArray(prepCategories) && prepCategories.length > 0) {
          prepCategoriesMultiple = prepCategories.filter(Boolean)
          prepCategorySingle = prepCategoriesMultiple[0] || null // Keep first as legacy single for backward compatibility
        } else if (prepCategory && prepCategory.trim()) {
          prepCategorySingle = prepCategory.trim()
        }

        const data = {
          name: name.trim(),
          description: description?.trim() || '',
          supplier: supplier?.trim() || '',
          cost: cost ? parseFloat(cost.toString()) : 0,
          prepCategory: prepCategorySingle,
          prepCategories: prepCategoriesMultiple,
        }

        if (id && id !== 'new') {
          // Update existing item
          await prisma.otherProduct.update({
            where: { id },
            data
          })
          results.updated++
        } else {
          // Create new item
          await prisma.otherProduct.create({
            data
          })
          results.created++
        }
      } catch (error) {
        results.errors++
        console.error(`Error updating other item ${item.name || item.id}:`, error)
        results.errorsList.push({
          id: item.id || 'unknown',
          name: item.name || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk update completed: ${results.updated} updated, ${results.created} created, ${results.errors} errors`,
      results
    })
  } catch (error) {
    console.error('Error in bulk update other items:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update other items', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
