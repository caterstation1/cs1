import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessLevel } from '@/lib/authz';
import { cloudinary } from '@/lib/cloudinary';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getAccessLevel()
    if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params;
    const component = await (prisma as any).component.findUnique({
      where: { id },
      include: { images: { orderBy: { position: 'asc' } } }
    })
    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }
    return NextResponse.json(component)
  } catch (error) {
    console.error('❌ Error fetching component:', error);
    return NextResponse.json(
      { error: 'Failed to fetch component' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getAccessLevel()
    if (!role || (role !== 'admin' && role !== 'owner' && role !== 'basic')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params;
    const body = await request.json();
    // Normalize yield fields and compute derived
    const producedQuantity = Number(body.producedQuantity ?? 1);
    const producedUnit = String(body.producedUnit ?? 'unit');
    const rawWeight = body.rawWeight !== undefined ? Number(body.rawWeight) : null;
    const cookedWeight = body.cookedWeight !== undefined ? Number(body.cookedWeight) : null;
    const trimWasteWeight = body.trimWasteWeight !== undefined ? Number(body.trimWasteWeight) : null;
    const weightUnit = body.weightUnit ?? null;
    const toBase = (qty: number, unit: string): { value: number; normalizedUnit: string } => {
      const u = (unit || '').toLowerCase();
      if (u === 'g') return { value: qty / 1000, normalizedUnit: 'kg' };
      if (u === 'ml') return { value: qty / 1000, normalizedUnit: 'l' };
      if (u === 'kg' || u === 'l') return { value: qty, normalizedUnit: u };
      return { value: qty, normalizedUnit: 'unit' };
    };
    const totalCost = Number(body.totalCost || 0);
    const base = toBase(producedQuantity, producedUnit);
    const costPerOutputUnit = base.value > 0 ? totalCost / base.value : 0;
    
    // Update core fields
    const component = await (prisma as any).component.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        ingredients: body.ingredients,
        totalCost,
        prepCategory: body.prepCategory ?? null,
        producedQuantity,
        producedUnit,
        rawWeight: rawWeight as any,
        cookedWeight: cookedWeight as any,
        trimWasteWeight: trimWasteWeight as any,
        weightUnit: weightUnit as any,
        costPerOutputUnit,
        normalizedOutputUnit: base.normalizedUnit,
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
      const toDelete = component.images.filter((img: { id: string; publicId: string }) => !incoming.some((inc: { publicId: string }) => inc.publicId === img.publicId))
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
    const role = await getAccessLevel()
    if (!role || (role !== 'admin' && role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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