import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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