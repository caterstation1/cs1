import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcryptjs from 'bcryptjs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';
    if (newPassword) {
      const existing = await prisma.supplier.findUnique({ where: { id } });
      const nextEmail = body.contactEmail !== undefined ? (body.contactEmail || '').trim().toLowerCase() : (existing?.contactEmail || '').trim().toLowerCase();
      if (!nextEmail) {
        return NextResponse.json(
          { error: 'Contact email is required when creating a login password' },
          { status: 400 }
        );
      }
    }
    const passwordHash = newPassword ? await bcryptjs.hash(newPassword, 10) : undefined;
    
    console.log(`🔄 Updating supplier ${id}...`);
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.contactNumber !== undefined && { contactNumber: body.contactNumber }),
        ...(body.contactEmail !== undefined && { contactEmail: (body.contactEmail || '').trim().toLowerCase() || null }),
        ...(body.mpiNumber !== undefined && { mpiNumber: (body.mpiNumber || '').trim() || null }),
        ...(body.accountNumber !== undefined && { accountNumber: (body.accountNumber || '').trim() || null }),
        ...(body.loginAccessLevel !== undefined && { loginAccessLevel: body.loginAccessLevel || 'bakery' }),
        ...(body.emailSettings !== undefined && { emailSettings: body.emailSettings }),
        ...(passwordHash !== undefined && { password: passwordHash }),
      }
    });
    
    console.log(`✅ Updated supplier: ${supplier.name}`);
    return NextResponse.json({
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName,
      contactNumber: supplier.contactNumber,
      contactEmail: supplier.contactEmail,
      mpiNumber: supplier.mpiNumber,
      accountNumber: supplier.accountNumber,
      loginAccessLevel: supplier.loginAccessLevel,
      hasPassword: Boolean(supplier.password),
      emailSettings: supplier.emailSettings,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    });
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
