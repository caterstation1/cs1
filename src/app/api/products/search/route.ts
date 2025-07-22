import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for product search
export async function GET() {
  return NextResponse.json({
    message: 'Product search API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
} 