import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for Shopify products sync
export async function GET() {
  return NextResponse.json({
    message: 'Shopify products API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
} 