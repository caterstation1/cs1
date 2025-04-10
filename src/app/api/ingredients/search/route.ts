import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const source = searchParams.get('source') || 'Gilmours';

    if (!query) {
      return NextResponse.json([]);
    }

    // Search based on the source
    let results = [];

    switch (source) {
      case 'Gilmours':
        results = await prisma.gilmoursProduct.findMany({
          where: {
            OR: [
              { description: { contains: query } },
              { brand: { contains: query } },
              { sku: { contains: query } },
            ],
          },
          select: {
            id: true,
            sku: true,
            brand: true,
            description: true,
            price: true,
            uom: true,
          },
          take: 10,
        });
        
        // Format Gilmours results
        results = results.map(item => ({
          id: item.id,
          name: item.description || item.brand || 'Unknown',
          cost: item.price || 0,
          unit: item.uom || 'g',
        }));
        break;

      case 'Bidfood':
        results = await prisma.bidfoodProduct.findMany({
          where: {
            OR: [
              { description: { contains: query } },
              { brand: { contains: query } },
              { productCode: { contains: query } },
            ],
          },
          select: {
            id: true,
            description: true,
            lastPricePaid: true,
            uom: true,
          },
          take: 10,
        });
        
        // Format Bidfood results
        results = results.map(item => ({
          id: item.id,
          name: item.description || 'Unknown',
          cost: item.lastPricePaid || 0,
          unit: item.uom || 'g',
        }));
        break;

      case 'Other':
        results = await prisma.otherProduct.findMany({
          where: {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
            cost: true,
          },
          take: 10,
        });
        
        // Format Other results
        results = results.map(item => ({
          id: item.id,
          name: item.name || item.description || 'Unknown',
          cost: item.cost || 0,
          unit: 'g', // Default unit for other products
        }));
        break;

      case 'Components':
        results = await prisma.component.findMany({
          where: {
            name: { contains: query },
          },
          select: {
            id: true,
            name: true,
            description: true,
            totalCost: true,
          },
          take: 10,
        });
        
        // Format Components results
        results = results.map(item => ({
          id: item.id,
          name: item.name || item.description || 'Unknown',
          cost: item.totalCost || 0,
          unit: 'unit', // Components are typically measured in units
        }));
        break;

      case 'Products':
        results = await prisma.product.findMany({
          where: {
            name: { contains: query },
          },
          select: {
            id: true,
            name: true,
            description: true,
            totalCost: true,
          },
          take: 10,
        });
        
        // Format Products results
        results = results.map(item => ({
          id: item.id,
          name: item.name || item.description || 'Unknown',
          cost: item.totalCost || 0,
          unit: 'unit', // Products are typically measured in units
        }));
        break;

      default:
        return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to search ingredients' },
      { status: 500 }
    );
  }
} 