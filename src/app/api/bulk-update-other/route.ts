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
          unit,
          cost,
          prepCategory,
          allergens,
          dietary,
          images,
          ingredients,
          instructions,
          hasGluten,
          hasDairy,
          hasSoy,
          hasOnionGarlic,
          hasSesame,
          hasNuts,
          hasEgg,
          isVegetarian,
          isVegan,
          isHalal
        } = item

        if (!name || name.trim() === '') {
          results.errors++
          results.errorsList.push({ id, error: 'Name is required' })
          continue
        }

        const data: any = {
          name: name.trim(),
          description: description?.trim() || null,
          unit: unit?.trim() || null,
          cost: cost ? parseFloat(cost) : null,
          prepCategory: prepCategory?.trim() || null,
          allergens: allergens || [],
          dietary: dietary || [],
          images: images || [],
          ingredients: ingredients || [],
          instructions: instructions?.trim() || null,
          hasGluten: Boolean(hasGluten),
          hasDairy: Boolean(hasDairy),
          hasSoy: Boolean(hasSoy),
          hasOnionGarlic: Boolean(hasOnionGarlic),
          hasSesame: Boolean(hasSesame),
          hasNuts: Boolean(hasNuts),
          hasEgg: Boolean(hasEgg),
          isVegetarian: Boolean(isVegetarian),
          isVegan: Boolean(isVegan),
          isHalal: Boolean(isHalal),
        }
        
        // Add totalCost if cost is provided
        if (cost) {
          data.totalCost = parseFloat(cost)
        }

        if (id && id !== 'new') {
          // Update existing item
          await prisma.otherItem.update({
            where: { id },
            data
          })
          results.updated++
        } else {
          // Create new item
          await prisma.otherItem.create({
            data
          })
          results.created++
        }
      } catch (error) {
        results.errors++
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
