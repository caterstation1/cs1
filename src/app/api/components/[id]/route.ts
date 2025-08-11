import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cloudinary } from '@/lib/cloudinary';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Update core fields
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
        isComponentListItem: body.isComponentListItem !== undefined ? body.isComponentListItem : true,
      },
      include: { images: true }
    });

    // Sync images if provided
    if (Array.isArray(body.images)) {
      const incoming = body.images.slice(0, 5).map((img: any, idx: number) => ({
        publicId: img.publicId || img.public_id,
        url: img.url || img.secure_url,
        alt: img.alt || null,
        position: Number(img.position ?? idx)
      }))

      // Delete images not present in payload
      const toDelete = component.images.filter((img) => !incoming.some((inc: { publicId: string }) => inc.publicId === img.publicId))
      if (toDelete.length) {
        await prisma.componentImage.deleteMany({
          where: { id: { in: toDelete.map((i: any) => i.id) } }
        })
      }

      // Upsert incoming
      // Upsert by (componentId, publicId) using delete/create approach for Prisma uniqueness
      // Delete existing record with same publicId for this component, then create
      for (const [idx, img] of incoming.entries()) {
        await prisma.componentImage.deleteMany({ where: { componentId: id, publicId: img.publicId } })
        await prisma.componentImage.create({
          data: { componentId: id, publicId: img.publicId, url: img.url, alt: img.alt, position: Number(img.position ?? idx) }
        })
      }
    }
    
    console.log(`✅ Updated component: ${component.name}`);
    const withImages = await (prisma as any).component.findUnique({
      where: { id },
      include: { images: { orderBy: { position: 'asc' } } }
    })
    return NextResponse.json(withImages);
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
    
    // Cascade delete images first (DB). Also attempt Cloudinary deletion when configured
    const images = await (prisma as any).componentImage.findMany({ where: { componentId: id } })
    if (cloudinary && images.length) {
      try {
        const publicIds = images.map((i: any) => i.publicId)
        await cloudinary.api.delete_resources(publicIds)
      } catch (err) {
        console.error('Cloudinary delete failed (continuing):', err)
      }
    }
    await prisma.componentImage.deleteMany({ where: { componentId: id } })
    await prisma.component.delete({ where: { id } });
    
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