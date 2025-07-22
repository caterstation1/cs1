import { NextResponse } from 'next/server';
// TODO: Implement Firestore adapter for staff login/auth
export async function POST() {
  return NextResponse.json({
    message: 'Login API not yet migrated to Firestore. TODO: Implement Firestore adapter.',
    token: null
  });
} 