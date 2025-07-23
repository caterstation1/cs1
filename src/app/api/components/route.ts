import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';

export async function GET() {
  try {
    // Fetch all components from Firestore
    const snapshot = await db.collection('components').get();
    const components = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    return NextResponse.json(
      { error: 'Failed to fetch components', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Create a new component in Firestore
    const docRef = await db.collection('components').add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Get the created document
    const doc = await docRef.get();
    const component = { id: doc.id, ...doc.data() };
    
    return NextResponse.json(component);
  } catch (error) {
    console.error('Error creating component:', error);
    return NextResponse.json(
      { error: 'Failed to create component', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 