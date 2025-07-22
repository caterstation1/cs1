import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for Bidfood products
export async function GET() {
  return NextResponse.json({
    message: 'Bidfood products API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    products: []
  });
} 