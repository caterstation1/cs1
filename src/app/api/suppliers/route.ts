import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for suppliers
export async function GET() {
  return NextResponse.json({
    message: 'Suppliers API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    suppliers: []
  });
} 