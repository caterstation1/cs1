import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessLevel } from '@/lib/authz';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getAccessLevel();
    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const variants = await prisma.productVariant.findMany({
      where: {
        productId: id
      },
      include: {
        product: {
          select: {
            id: true,
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true
          }
        }
      },
      orderBy: {
        shopifyName: 'asc'
      }
    });

    return NextResponse.json(variants);
  } catch (error) {
    console.error('Error fetching product variants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product variants' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getAccessLevel();
    if (!role || (role !== 'admin' && role !== 'owner' && role !== 'basic')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify the product exists
    const product = await prisma.shopifyProduct.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        variantId: body.variantId,
        shopifySku: body.shopifySku,
        shopifyName: body.shopifyName,
        shopifyTitle: body.shopifyTitle,
        shopifyPrice: body.shopifyPrice,
        shopifyInventory: body.shopifyInventory,
        displayName: body.displayName,
        meat1: body.meat1,
        meat2: body.meat2,
        timer1: body.timer1,
        timer2: body.timer2,
        option1: body.option1,
        option2: body.option2,
        serveware: body.serveware ?? false,
        isDraft: body.isDraft ?? false,
        ingredients: body.ingredients,
        totalCost: body.totalCost ?? 0
      },
      include: {
        product: {
          select: {
            id: true,
            shopifyProductId: true,
            productTitle: true,
            displayName: true,
            heroImageUrl: true
          }
        }
      }
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (error) {
    console.error('Error creating product variant:', error);
    return NextResponse.json(
      { error: 'Failed to create product variant' },
      { status: 500 }
    );
  }
}


