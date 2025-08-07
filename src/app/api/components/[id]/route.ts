import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const component = await prisma.component.update({
      where: { id },
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
        isHalal: body.isHalal || false,
        isComponentListItem: body.isComponentListItem !== undefined ? body.isComponentListItem : true
      }
    });
    
    console.log(`✅ Updated component: ${component.name}`);
    return NextResponse.json(component);
  } catch (error) {
    console.error('❌ Error updating component:', error);
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await prisma.component.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted component with ID: ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting component:', error);
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    );
  }
} 