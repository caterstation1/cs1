import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Fetching components...')
    const components = await prisma.component.findMany({
      orderBy: {
        name: 'asc',
      },
    })
    console.log(`Found ${components.length} components`)
    return NextResponse.json(components)
  } catch (error) {
    console.error('Error fetching components:', error)
    return NextResponse.json(
      { error: 'Failed to fetch components' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Processing component data...')
    const data = await request.json()
    console.log('Received component data:', JSON.stringify(data, null, 2))
    
    if (!data.name) {
      console.error('Component name is missing')
      return NextResponse.json(
        { error: 'Component name is required' },
        { status: 400 }
      )
    }
    
    // Validate ingredients
    if (!Array.isArray(data.ingredients)) {
      console.error('Ingredients is not an array:', data.ingredients)
      return NextResponse.json(
        { error: 'Ingredients must be an array' },
        { status: 400 }
      )
    }
    
    // Validate each ingredient
    for (const ingredient of data.ingredients) {
      if (!ingredient.source || !ingredient.id || typeof ingredient.quantity !== 'number' || typeof ingredient.cost !== 'number') {
        console.error('Invalid ingredient:', ingredient)
        return NextResponse.json(
          { error: 'Invalid ingredient data. Each ingredient must have source, id, quantity (number), and cost (number)' },
          { status: 400 }
        )
      }
    }
    
    // Calculate total cost from ingredients
    const totalCost = calculateTotalCost(data.ingredients)
    console.log('Calculated total cost:', totalCost)
    
    // Prepare component data
    const componentData = {
      name: data.name,
      description: data.description || '',
      ingredients: data.ingredients,
      totalCost,
      hasGluten: !!data.hasGluten,
      hasDairy: !!data.hasDairy,
      hasSoy: !!data.hasSoy,
      hasOnionGarlic: !!data.hasOnionGarlic,
      hasSesame: !!data.hasSesame,
      hasNuts: !!data.hasNuts,
      hasEgg: !!data.hasEgg,
      isVegetarian: !!data.isVegetarian,
      isVegan: !!data.isVegan,
      isHalal: !!data.isHalal,
    }
    
    console.log('Saving component with data:', JSON.stringify(componentData, null, 2))
    
    let component;
    if (data.id) {
      // Update existing component
      console.log(`Updating existing component with id: ${data.id}`)
      component = await prisma.component.update({
        where: { id: data.id },
        data: componentData,
      })
      console.log(`Updated existing component: ${component.name}`)
    } else {
      // Create new component
      console.log('Creating new component')
      component = await prisma.component.create({
        data: componentData,
      })
      console.log(`Created new component: ${component.name}`)
    }
    
    return NextResponse.json(component)
  } catch (error) {
    console.error('Error processing component:', error)
    return NextResponse.json(
      { error: `Failed to process component: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

function calculateTotalCost(ingredients: any[]): number {
  return ingredients.reduce((total, ingredient) => {
    return total + (ingredient.quantity * ingredient.cost)
  }, 0)
} 