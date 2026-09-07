import { prisma } from '@/lib/prisma';
import bcryptjs from 'bcryptjs';

export async function GET() {
  try {
    console.log('🏢 Fetching suppliers from PostgreSQL...');
    
    const suppliersRaw = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    const suppliers = suppliersRaw.map((s) => ({
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      contactNumber: s.contactNumber,
      contactEmail: s.contactEmail,
      mpiNumber: s.mpiNumber,
      accountNumber: s.accountNumber,
      loginAccessLevel: s.loginAccessLevel,
      hasPassword: Boolean(s.password),
      emailSettings: s.emailSettings,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    
    console.log(`✅ Successfully fetched ${suppliers.length} suppliers`);
    return new Response(JSON.stringify(suppliers), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ Error fetching suppliers:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch suppliers' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = (body.contactEmail || '').trim().toLowerCase();
    const newPassword = (body.newPassword || '').trim();
    if (newPassword && !rawEmail) {
      return new Response(JSON.stringify({ error: 'Contact email is required when creating a login password' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const loginAccessLevel = body.loginAccessLevel || 'bakery';
    const passwordHash = newPassword ? await bcryptjs.hash(newPassword, 10) : null;
    
    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        contactName: body.contactName,
        contactNumber: body.contactNumber,
        contactEmail: rawEmail || null,
        mpiNumber: typeof body.mpiNumber === 'string' ? body.mpiNumber.trim() || null : null,
        accountNumber: typeof body.accountNumber === 'string' ? body.accountNumber.trim() || null : null,
        loginAccessLevel,
        password: passwordHash,
      }
    });
    
    console.log(`✅ Created supplier: ${supplier.name}`);
    return new Response(JSON.stringify({
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
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ Error creating supplier:', error);
    return new Response(JSON.stringify({ error: 'Failed to create supplier' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 