import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Best-effort ensure carId column exists
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carId" TEXT');
    } catch {}
    const { id } = await params;
    
    console.log(`🔍 Fetching order ${id} from PostgreSQL...`);
    
    const order = await prisma.order.findUnique({
      where: { id }
    });
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Found order: ${order.orderNumber}`);
    return NextResponse.json(order);
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Best-effort ensure carId column exists
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carId" TEXT');
    } catch {}
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🔄 Updating order ${id} in PostgreSQL...`);
    
    // Compute resolved delivery day from updated fields
    const existing = await prisma.order.findUnique({ where: { id } })
    const candidate = {
      deliveryDate: body.deliveryDate ?? existing?.deliveryDate,
      noteAttributes: body.noteAttributes ?? existing?.noteAttributes,
      tags: body.tags ?? existing?.tags,
      createdAt: existing?.createdAt,
    }
    const resolved = resolveDeliveryDateResolved(candidate)

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...body,
        hasLocalEdits: true,
        deliveryDateResolved: resolved.date,
        deliveryDateResolvedSource: resolved.source,
        deliveryDateResolvedAt: new Date(),
      }
    });
    
    console.log(`✅ Updated order: ${order.orderNumber}`);
    return NextResponse.json(order);
  } catch (error) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Best-effort ensure carId column exists
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE \"Order\" ADD COLUMN IF NOT EXISTS \"carId\" TEXT');
    } catch {}
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🔄 Patching order ${id} in PostgreSQL...`);
    
    const existing = await prisma.order.findUnique({ where: { id } })
    const candidate = {
      deliveryDate: body.deliveryDate ?? existing?.deliveryDate,
      noteAttributes: body.noteAttributes ?? existing?.noteAttributes,
      tags: body.tags ?? existing?.tags,
      createdAt: existing?.createdAt,
    }
    const resolved = resolveDeliveryDateResolved(candidate)

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...body,
        hasLocalEdits: true,
        deliveryDateResolved: resolved.date,
        deliveryDateResolvedSource: resolved.source,
        deliveryDateResolvedAt: new Date(),
      }
    });
    
    console.log(`✅ Patched order: ${order.orderNumber}`);
    return NextResponse.json(order);
  } catch (error) {
    console.error('❌ Error patching order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
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
    
    console.log(`🗑️ Deleting order ${id} from PostgreSQL...`);
    
    await prisma.order.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted order: ${id}`);
    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
} 