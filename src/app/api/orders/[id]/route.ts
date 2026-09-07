import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { resolveDeliveryDateResolved } from '@/lib/delivery-date-resolver';
import { canonicalizeOrderScheduling } from '@/lib/order-canonicalize';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/authz';
import { buildOrderChangeEntries, writeOrderChangeLog } from '@/lib/order-change-log';

// Callers (edit modals, calendar views) often PATCH back the entire order object,
// which can carry computed fields (isFirstOrder), relations (orderChangeLogs), or
// read-only columns. Prisma rejects unknown arguments with a 500, so only allow
// real, writable Order columns through.
const ORDER_UPDATABLE_FIELDS = new Set<string>(Object.values(Prisma.OrderScalarFieldEnum));
for (const readOnlyField of ['id', 'dbCreatedAt', 'dbUpdatedAt']) {
  ORDER_UPDATABLE_FIELDS.delete(readOnlyField);
}

function pickUpdatableOrderFields(rawBody: unknown): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  if (rawBody && typeof rawBody === 'object') {
    for (const [key, value] of Object.entries(rawBody)) {
      if (ORDER_UPDATABLE_FIELDS.has(key)) sanitized[key] = value;
    }
  }
  return sanitized;
}

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
      where: { id },
      include: {
        orderChangeLogs: {
          orderBy: { changedAt: 'desc' },
          take: 200,
        },
      },
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

async function updateOrderWithAudit(
  request: Request,
  params: Promise<{ id: string }>,
  action: 'ORDER_UPDATED_PUT' | 'ORDER_UPDATED_PATCH'
) {
  try {
    // Best-effort ensure carId column exists
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carId" TEXT');
    } catch {}
    const { id } = await params;
    const rawBody = await request.json();
    const body = pickUpdatableOrderFields(rawBody);
    
    console.log(`🔄 Updating order ${id} in PostgreSQL...`);
    
    // Compute resolved delivery day from updated fields
    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const candidate = {
      deliveryDate: body.deliveryDate ?? existing?.deliveryDate,
      noteAttributes: body.noteAttributes ?? existing?.noteAttributes,
      tags: body.tags ?? existing?.tags,
      createdAt: existing?.createdAt,
    }
    const resolved = resolveDeliveryDateResolved(candidate)
    
    // Recalculate canonical scheduling fields
    const updatedOrderData = {
      ...existing,
      ...body,
      shippingAddress: body.shippingAddress ?? existing?.shippingAddress,
      noteAttributes: body.noteAttributes ?? existing?.noteAttributes,
    }
    const scheduling = canonicalizeOrderScheduling(updatedOrderData as any)

    // Maintain the fresh-dispatch timestamp used by delivery-run tracking
    // eligibility. Only touch it when the payload explicitly changes dispatch
    // state: stamp on false -> true transitions, clear when un-dispatched.
    let dispatchedAtUpdate: { dispatchedAt: Date | null } | undefined
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'isDispatched')) {
      if (body.isDispatched === true && existing.isDispatched !== true) {
        dispatchedAtUpdate = { dispatchedAt: new Date() }
      } else if (body.isDispatched === false) {
        dispatchedAtUpdate = { dispatchedAt: null }
      }
    }

    const updateData = {
      ...body,
      ...dispatchedAtUpdate,
      hasLocalEdits: true,
      deliveryDateResolved: resolved.date,
      deliveryDateResolvedSource: resolved.source,
      deliveryDateResolvedAt: new Date(),
      // Update canonical scheduling fields
      region: scheduling.region,
      deliveryDateTime: scheduling.deliveryDateTime,
      deliveryDateSource: scheduling.deliveryDateSource,
      needsSchedulingReview: scheduling.needsSchedulingReview,
    };

    const order = await prisma.order.update({
      where: { id },
      data: updateData
    });

    const session = await getServerSession(authOptions).catch(() => null);
    const actor = session?.user
      ? {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
        }
      : undefined;

    const candidateKeys = [
      ...Object.keys(body || {}),
      ...(dispatchedAtUpdate ? ['dispatchedAt'] : []),
      'hasLocalEdits',
      'deliveryDateResolved',
      'deliveryDateResolvedSource',
      'deliveryDateResolvedAt',
      'region',
      'deliveryDateTime',
      'deliveryDateSource',
      'needsSchedulingReview',
    ];
    const changes = buildOrderChangeEntries(
      existing as unknown as Record<string, unknown>,
      order as unknown as Record<string, unknown>,
      candidateKeys
    );
    await writeOrderChangeLog({
      orderId: id,
      action,
      changes,
      actor,
      source: new URL(request.url).pathname,
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateOrderWithAudit(request, params, 'ORDER_UPDATED_PUT');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateOrderWithAudit(request, params, 'ORDER_UPDATED_PATCH');
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Deleting an order is destructive — restrict to elevated roles rather than
    // any logged-in staffer (the `basic` role can reach /api/orders via middleware).
    try {
      await requireRole(['owner', 'admin', 'manager']);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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