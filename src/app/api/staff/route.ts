import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('👥 Fetching staff from PostgreSQL...');
    
    const staff = await prisma.staff.findMany({
      orderBy: {
        firstName: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${staff.length} staff members`);
    return NextResponse.json(staff);
  } catch (error) {
    console.error('❌ Error fetching staff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const staff = await prisma.staff.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        payRate: body.payRate || 0,
        accessLevel: body.accessLevel || 'basic',
        isDriver: body.isDriver || false,
        isActive: body.isActive !== false, // Default to true
        password: body.password // Note: Should be hashed in production
      }
    });
    
    console.log(`✅ Created staff member: ${staff.firstName} ${staff.lastName}`);
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating staff:', error);
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    );
  }
}
