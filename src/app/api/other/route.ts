import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for other products
export async function GET() {
  return NextResponse.json({
    message: 'Other products API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
} 