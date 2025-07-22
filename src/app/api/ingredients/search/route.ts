import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const source = searchParams.get('source') || 'All';

    // TODO: Migrate to Firestore
    // This route is not yet migrated to Firestore
    // For now, return empty results to prevent Prisma usage
    
    console.log(`Ingredients search requested: query="${query}", source="${source}"`);
    
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to search ingredients' },
      { status: 500 }
    );
  }
} 