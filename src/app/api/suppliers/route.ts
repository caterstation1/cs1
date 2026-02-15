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
    return new Response(JSON.stringify(suppliers), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ Error fetching suppliers:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch suppliers' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
    return new Response(JSON.stringify(supplier), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ Error creating supplier:', error);
    return new Response(JSON.stringify({ error: 'Failed to create supplier' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 