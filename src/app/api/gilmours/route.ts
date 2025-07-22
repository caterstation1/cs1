import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for Gilmours products
export async function GET() {
  return NextResponse.json({
    message: 'Gilmours products API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
} 