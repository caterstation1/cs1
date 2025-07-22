import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for order parsing
export async function POST() {
  return NextResponse.json({
    message: 'Order parse-all API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    parsed: false
  });
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
} 