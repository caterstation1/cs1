import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const { components } = await request.json()

    if (!Array.isArray(components)) {
      return NextResponse.json(
        { error: 'Components must be an array' },
        { status: 400 }
      )
    }

    const results = {
      updated: 0,
      created: 0,
      errors: 0,
      errorsList: [] as any[]
    }

    for (const component of components) {
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
        } = component

        if (!name || name.trim() === '') {
          results.errors++
          results.errorsList.push({ id, error: 'Name is required' })
          continue
        }

        const data = {
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

        if (id && id !== 'new') {
          // Update existing component
          await prisma.component.update({
            where: { id },
            data
          })
          results.updated++
        } else {
          // Create new component
          await prisma.component.create({
            data
          })
          results.created++
        }
      } catch (error) {
        results.errors++
        results.errorsList.push({
          id: component.id || 'unknown',
          name: component.name || 'unknown',
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
    console.error('Error in bulk update components:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update components', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
