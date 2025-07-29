import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🧩 Fetching components from PostgreSQL...');
    
    const components = await prisma.component.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${components.length} components`);
    return NextResponse.json(components);
  } catch (error) {
    console.error('❌ Error fetching components:', error);
    return NextResponse.json(
      { error: 'Failed to fetch components' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const component = await prisma.component.create({
      data: {
        name: body.name,
        description: body.description,
        ingredients: body.ingredients,
        totalCost: body.totalCost || 0,
        hasGluten: body.hasGluten || false,
        hasDairy: body.hasDairy || false,
        hasSoy: body.hasSoy || false,
        hasOnionGarlic: body.hasOnionGarlic || false,
        hasSesame: body.hasSesame || false,
        hasNuts: body.hasNuts || false,
        hasEgg: body.hasEgg || false,
        isVegetarian: body.isVegetarian || false,
        isVegan: body.isVegan || false,
        isHalal: body.isHalal || false
      }
    });
    
    console.log(`✅ Created component: ${component.name}`);
    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating component:', error);
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    );
  }
} 