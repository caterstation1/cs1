import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🏢 Fetching suppliers from PostgreSQL...');
    
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${suppliers.length} suppliers`);
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('❌ Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        contactName: body.contactName,
        contactNumber: body.contactNumber,
        contactEmail: body.contactEmail
      }
    });
    
    console.log(`✅ Created supplier: ${supplier.name}`);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
} 