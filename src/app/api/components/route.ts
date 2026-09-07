import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeComponentCost } from '@/lib/pricing/persist';

export async function GET() {
  try {
    console.log('🧩 Fetching components from PostgreSQL...');
    
    const components = await (prisma as any).component.findMany({
      orderBy: { name: 'asc' },
      include: { images: { orderBy: { position: 'asc' } } }
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
    // Normalize yield fields
    const producedQuantity = Number(body.producedQuantity ?? 1);
    const producedUnit = String(body.producedUnit ?? 'unit');
    const rawWeight = body.rawWeight !== undefined ? Number(body.rawWeight) : null;
    const cookedWeight = body.cookedWeight !== undefined ? Number(body.cookedWeight) : null;
    const trimWasteWeight = body.trimWasteWeight !== undefined ? Number(body.trimWasteWeight) : null;
    const weightUnit = body.weightUnit ?? null;

    // Cost is derived here, not taken from the browser. body.totalCost is kept
    // only as a fallback for a recipe the engine cannot resolve.
    const cost = await computeComponentCost({
      name: body.name,
      ingredients: body.ingredients,
      producedQuantity,
      producedUnit,
      clientTotalCost: Number(body.totalCost || 0),
    });
    if (!cost.serverDerived) {
      console.warn(
        `⚠️  Component "${body.name}" could not be fully costed (${cost.reasons.join(', ')}); kept the submitted total.`
      );
    }

    const component = await (prisma as any).component.create({
      data: {
        name: body.name,
        description: body.description,
        ingredients: body.ingredients,
        totalCost: cost.totalCost,
        prepCategory: body.prepCategory ?? null,
        prepCategories: body.prepCategories ?? null,
        producedQuantity,
        producedUnit,
        rawWeight: rawWeight as any,
        cookedWeight: cookedWeight as any,
        trimWasteWeight: trimWasteWeight as any,
        weightUnit: weightUnit as any,
        costPerOutputUnit: cost.costPerOutputUnit,
        normalizedOutputUnit: cost.normalizedOutputUnit,
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

    if (Array.isArray(body.images) && body.images.length) {
      await (prisma as any).componentImage.createMany({
        data: body.images.slice(0, 5).map((img: any, idx: number) => ({
          componentId: component.id,
          publicId: img.publicId || img.public_id,
          url: img.url || img.secure_url,
          alt: img.alt || null,
          position: Number(img.position ?? idx)
        }))
      })
    }

    const withImages = await (prisma as any).component.findUnique({
      where: { id: component.id },
      include: { images: { orderBy: { position: 'asc' } } }
    })
    
    console.log(`✅ Created component: ${component.name}`);
    return NextResponse.json(withImages, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating component:', error);
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    );
  }
} 