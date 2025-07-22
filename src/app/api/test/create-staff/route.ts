import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for test staff creation
export async function GET() {
  return NextResponse.json({
    message: 'Test staff creation API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    staff: null
  });
} 