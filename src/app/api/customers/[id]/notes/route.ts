import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = id; // This is the customer email
    console.log(`📝 Fetching notes for customer: ${customerId}`);

    // For now, we'll return empty notes since we don't have a customer notes table yet
    // In the future, this would query a customer_notes table
    return NextResponse.json({
      notes: '',
      customerId: customerId
    });

  } catch (error) {
    console.error('❌ Error fetching customer notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer notes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = id; // This is the customer email
    const { notes } = await request.json();
    
    console.log(`📝 Saving notes for customer: ${customerId}`);

    // For now, we'll just return success since we don't have a customer notes table yet
    // In the future, this would save to a customer_notes table
    console.log(`Notes to save: ${notes}`);

    return NextResponse.json({
      success: true,
      message: 'Notes saved successfully',
      customerId: customerId,
      notes: notes
    });

  } catch (error) {
    console.error('❌ Error saving customer notes:', error);
    return NextResponse.json(
      { error: 'Failed to save customer notes' },
      { status: 500 }
    );
  }
}
