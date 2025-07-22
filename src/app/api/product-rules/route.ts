import { NextRequest, NextResponse } from 'next/server';
import { ruleAdapter } from '@/lib/firestore-adapters';

export async function GET() {
  try {
    const rules = await ruleAdapter.findMany();
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching product rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const rule = await ruleAdapter.create({ ...data });
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating product rule:', error);
    return NextResponse.json(
      { error: 'Failed to create product rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const rule = await ruleAdapter.update({ id: data.id }, data);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error updating product rule:', error);
    return NextResponse.json(
      { error: 'Failed to update product rule' },
      { status: 500 }
    );
  }
} 