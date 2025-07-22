import { NextResponse } from 'next/server';
// TODO: Remove or migrate test-db route for Firestore
export async function GET() {
  return NextResponse.json({
    message: 'Test DB API not yet migrated to Firestore. TODO: Remove or migrate.',
    test: true
  });
} 