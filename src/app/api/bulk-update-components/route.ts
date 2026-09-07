import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BulkComponentCostInput, computeComponentCostsBulk } from '@/lib/pricing/persist'

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

    // This route used to write totalCost and leave costPerOutputUnit and
    // normalizedOutputUnit untouched, so the three drifted apart on every bulk
    // save. All three are now derived together, from the recipe rather than
    // from the submitted `cost`.
    //
    // producedQuantity/producedUnit are not part of the bulk payload, so they
    // come from the stored row; a new component falls back to the 1-unit default.
    const existingRows = await prisma.component.findMany({
      where: { id: { in: components.map((c: any) => c?.id).filter((id: unknown) => typeof id === 'string' && id !== 'new') } },
      select: { id: true, producedQuantity: true, producedUnit: true },
    })
    const producedById = new Map(existingRows.map((r) => [r.id, r]))

    const costInputs: BulkComponentCostInput[] = components
      .map((c: any, i: number): BulkComponentCostInput | null => {
        if (!c?.name || String(c.name).trim() === '') return null
        const stored = c.id && c.id !== 'new' ? producedById.get(c.id) : undefined
        return {
          key: String(c.id && c.id !== 'new' ? c.id : `new:${i}`),
          componentId: c.id && c.id !== 'new' ? c.id : null,
          name: String(c.name).trim(),
          ingredients: c.ingredients || [],
          producedQuantity: stored?.producedQuantity ?? 1,
          producedUnit: stored?.producedUnit ?? 'unit',
          clientTotalCost: c.cost ? parseFloat(String(c.cost)) : 0,
        }
      })
      .filter((c): c is BulkComponentCostInput => c !== null)

    const costs = await computeComponentCostsBulk(costInputs)

    for (const [i, component] of components.entries()) {
      try {
        const {
          id,
          name,
          description,
          unit,
          cost,
          prepCategory,
          prepCategories,
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

        // Handle prep categories: support both single and multiple
        let prepCategorySingle: string | null = null
        let prepCategoriesMultiple: string[] | null = null
        
        if (prepCategories && Array.isArray(prepCategories) && prepCategories.length > 0) {
          prepCategoriesMultiple = prepCategories.filter(Boolean)
          prepCategorySingle = prepCategoriesMultiple[0] || null // Keep first as legacy single for backward compatibility
        } else if (prepCategory && prepCategory.trim()) {
          prepCategorySingle = prepCategory.trim()
        }

        const costKey = String(id && id !== 'new' ? id : `new:${i}`)
        const derived = costs.get(costKey)

        const data: any = {
          name: name.trim(),
          description: description?.trim() || '',
          ingredients: ingredients || [],
          totalCost: derived ? derived.totalCost : cost ? parseFloat(cost.toString()) : 0,
          prepCategory: prepCategorySingle,
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

        // Written together with totalCost so the three cannot drift apart.
        if (derived) {
          data.costPerOutputUnit = derived.costPerOutputUnit
          data.normalizedOutputUnit = derived.normalizedOutputUnit
        }

        // Only include prepCategories if it's not null
        if (prepCategoriesMultiple !== null) {
          data.prepCategories = prepCategoriesMultiple
        }

        // Only include optional fields if they exist and have valid values
        if (unit && unit.trim()) data.unit = unit.trim()
        if (instructions && instructions.trim()) data.instructions = instructions.trim()

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
        console.error(`Error updating component ${component.name || component.id}:`, error)
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
