import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`🔄 Updating supplier ${id}...`);
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.contactNumber !== undefined && { contactNumber: body.contactNumber }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
        ...(body.emailSettings !== undefined && { emailSettings: body.emailSettings }),
      }
    });
    
    console.log(`✅ Updated supplier: ${supplier.name}`);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error('❌ Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Deleting supplier ${id}...`);
    
    await prisma.supplier.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted supplier: ${id}`);
    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
