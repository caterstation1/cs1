import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

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

    // Basic validation
    const required = ['firstName', 'lastName', 'email', 'phone', 'payRate', 'accessLevel']
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
      }
    }

    // Enforce allowed access levels
    const allowedAccess = ['basic', 'pricing_lab', 'admin', 'owner', 'wlg_team', 'wlg_admin']
    if (!allowedAccess.includes(body.accessLevel)) {
      return NextResponse.json({ error: 'Invalid access level' }, { status: 400 })
    }
    
    // Optional: prevent plaintext password storage if provided
    if (body.password && typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    // Create staff
    const staff = await prisma.staff.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        payRate: body.payRate || 0,
        accessLevel: body.accessLevel || 'basic',
        isDriver: !!body.isDriver,
        isActive: body.isActive !== false, // Default to true
        // Hash password if provided
        password: body.password ? await hashPassword(body.password) : null
      }
    });
    
    console.log(`✅ Created staff member: ${staff.firstName} ${staff.lastName}`);
    return NextResponse.json(staff, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating staff:', error);
    // Prisma unique constraint violation code
    if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to create staff member' },
      { status: 500 }
    );
  }
}
