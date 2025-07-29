import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🔍 Fetching product rule ${id} from PostgreSQL...`);
    
    const rule = await prisma.productRule.findUnique({
      where: { id }
    });
    
    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Found product rule: ${rule.name}`);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('❌ Error fetching product rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product rule' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🔄 Updating product rule ${id} in PostgreSQL...`);
    
    const rule = await prisma.productRule.update({
      where: { id },
      data: body
    });
    
    console.log(`✅ Updated product rule: ${rule.name}`);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('❌ Error updating product rule:', error);
    return NextResponse.json(
      { error: 'Failed to update product rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Deleting product rule ${id} from PostgreSQL...`);
    
    await prisma.productRule.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted product rule: ${id}`);
    return NextResponse.json({ message: 'Product rule deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete product rule' },
      { status: 500 }
    );
  }
} 