import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';

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
    console.error('Error fetching daily components:', error);
    
    // Check if it's a Firebase quota exceeded error
    if (error instanceof Error && error.message.includes('quota')) {
      return NextResponse.json({
        message: 'Firebase quota exceeded. Please upgrade your plan or try again later.',
        details: 'The free tier has been exceeded. Consider upgrading to a paid plan.',
        dailyComponents: []
      }, { status: 429 }); // Too Many Requests
    }
    
    // For other errors, return empty array instead of 500
    return NextResponse.json({
      message: 'Error fetching daily components',
      error: error instanceof Error ? error.message : 'Unknown error',
      dailyComponents: []
    }, { status: 200 }); // Return 200 with empty data instead of 500
  }
} 