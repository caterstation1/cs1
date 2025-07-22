import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for Shopify order sync
export async function GET() {
  return NextResponse.json({
    message: 'Shopify sync-orders API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    result: null
  });
} 