import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for components
export async function GET() {
  return NextResponse.json({
    message: 'Components API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    components: []
  });
} 