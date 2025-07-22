import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for daily components
export async function GET() {
  return NextResponse.json({
    message: 'Daily components API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    dailyComponents: []
  });
} 