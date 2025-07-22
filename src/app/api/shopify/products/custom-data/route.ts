import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for Shopify custom data
export async function POST() {
  return NextResponse.json({
    message: 'Shopify custom data API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    result: null
  });
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId');

    if (!variantId) {
      return NextResponse.json(
        { error: 'variantId is required' },
        { status: 400 }
      );
    }

    // This function is no longer using Prisma, so it's removed.
    // If Firestore is implemented, this function would need to be updated.
    // For now, it's a placeholder.
    return NextResponse.json({ success: true, message: 'Delete functionality not yet implemented for Firestore.' });
  } catch (error) {
    console.error('Error deleting custom data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete custom data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 400 }
    );
  }
} 