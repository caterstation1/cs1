import { NextRequest, NextResponse } from 'next/server';
import { fetchRunsheetData } from '@/lib/runsheet-data';
import { parseLocalDate } from '@/lib/date-utils';

interface ComponentRequirement {
  id: string
  name: string
  quantity: number
  unit: string
  totalCost: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const city = (searchParams.get('city') || 'AKL').toUpperCase();
    
    if (!dateParam) {
      return NextResponse.json({
        message: 'Date parameter is required',
        components: [],
        totalOrders: 0,
        totalProducts: 0,
        summary: {
          totalComponents: 0,
          totalQuantity: 0,
          totalCost: 0
        }
      });
    }

    // Build from runsheet summary (Out-the-Door logic) and exclude dispatched orders
    const baseDate = parseLocalDate(dateParam) || new Date(dateParam)
    const isWLG = city === 'WLG'
    const run = await fetchRunsheetData(baseDate, isWLG, true)

    // Flatten categories into a single clickable list, as before
    const items: ComponentRequirement[] = []
    const pushCategory = (catName: string, itemsMap?: Record<string, { total: number; am: number }>) => {
      if (!itemsMap) return
      Object.entries(itemsMap).forEach(([name, v]) => {
        items.push({
          id: `${catName}:${name}`,
          name: name,
          quantity: v.total,
          unit: '',
          totalCost: 0
        })
      })
    }
    pushCategory('Cold kitchen', run.tasksByCategory?.['Cold kitchen']?.items)
    pushCategory('Hot kitchen', run.tasksByCategory?.['Hot kitchen']?.items)
    pushCategory('Desserts', run.tasksByCategory?.['Desserts']?.items)
    // Addons
    for (const a of (run.addonsList || [])) {
      items.push({
        id: `Addons:${a.name}`,
        name: a.name,
        quantity: a.total,
        unit: '',
        totalCost: 0
      })
    }
    // Proteins by initial
    for (const p of (run.proteinsByInitial || [])) {
      items.push({
        id: `Proteins:${p.initial}`,
        name: `Protein ${p.initial}`,
        quantity: p.total,
        unit: '',
        totalCost: 0
      })
    }

    // Sort by quantity desc for initial display; UI will handle completed bottom
    const componentRequirements: ComponentRequirement[] = items
      .filter(i => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)

    // Calculate summary
    const summary = {
      totalComponents: componentRequirements.length,
      totalQuantity: componentRequirements.reduce((sum, comp) => sum + comp.quantity, 0),
      totalCost: 0
    };

    console.log(`✅ Daily components (runsheet-based): ${componentRequirements.length} items, total qty ${summary.totalQuantity}`);

    return NextResponse.json({
      message: 'Fetched daily components (runsheet-based).',
      components: componentRequirements,
      totalOrders: summary.totalComponents,
      totalProducts: summary.totalQuantity,
      summary
    });
  } catch (error) {
    console.error('❌ Error fetching daily components:', error);
    
    // Return empty array instead of error
    return NextResponse.json({
      message: 'Error fetching daily components',
      error: error instanceof Error ? error.message : 'Unknown error',
      components: [],
      totalOrders: 0,
      totalProducts: 0,
      summary: {
        totalComponents: 0,
        totalQuantity: 0,
        totalCost: 0
      }
    }, { status: 200 }); // Return 200 with empty data instead of 500
  }
}