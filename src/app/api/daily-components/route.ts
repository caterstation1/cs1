import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';

export async function GET() {
  try {
    // Fetch all components from Firestore
    const snapshot = await db.collection('components').get();
    const dailyComponents = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({
      message: 'Fetched daily components from Firestore.',
      dailyComponents
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Error fetching daily components',
      error: error instanceof Error ? error.message : error,
      dailyComponents: []
    }, { status: 500 });
  }
} 