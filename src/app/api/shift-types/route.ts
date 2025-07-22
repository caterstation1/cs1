import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for shift types
export async function GET() {
  return NextResponse.json({
    message: 'Shift types API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    shiftTypes: []
  });
} 