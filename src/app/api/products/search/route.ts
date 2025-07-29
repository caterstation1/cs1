import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Search in ProductWithCustomData table
    const products = await prisma.productWithCustomData.findMany({
      where: {
        OR: [
          { shopifyName: { contains: query, mode: 'insensitive' } },
          { shopifyTitle: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20,
      orderBy: {
        shopifyName: 'asc'
      }
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
} 