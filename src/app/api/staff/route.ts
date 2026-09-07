import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireRole } from '@/lib/authz';

export async function GET() {
  try {
    console.log('👥 Fetching staff from PostgreSQL...');
    
    // Never expose credential material (password hash, reset tokens) to any client.
    const staff = await prisma.staff.findMany({
      omit: {
        password: true,
        resetToken: true,
        resetTokenExpiry: true,
      },
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
    // Admin-only: creating staff (and assigning access levels) must not be
    // available to lower-privileged sessions — prevents privilege escalation.
    try {
      await requireRole(['owner', 'admin']);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Basic validation
    const required = ['firstName', 'lastName', 'email', 'phone', 'payRate', 'accessLevel']
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
      }
    }

    // Enforce allowed access levels
    const allowedAccess = ['basic', 'pricing_lab', 'admin', 'owner', 'wlg_team', 'wlg_admin', 'bakery']
    if (!allowedAccess.includes(body.accessLevel)) {
      return NextResponse.json({ error: 'Invalid access level' }, { status: 400 })
    }
    
    // Optional: prevent plaintext password storage if provided
    if (body.password && typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    // Create staff
    const staff = await prisma.staff.create({
      omit: { password: true, resetToken: true, resetTokenExpiry: true },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        payRate: body.payRate || 0,
        accessLevel: body.accessLevel || 'basic',
        isDriver: !!body.isDriver,
        isActive: body.isActive !== false, // Default to true
        includeInOpsLabour: body.includeInOpsLabour !== false, // Default to true
        password: body.password ? await hashPassword(body.password) : null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        addressLine1: body.addressLine1 ?? null,
        addressCity: body.addressCity ?? null,
        addressPostCode: body.addressPostCode ?? null,
        payMode: body.payMode ?? null,
        fixedWeeklyHours: body.fixedWeeklyHours != null ? body.fixedWeeklyHours : null,
      }
    });

    if (body.createInXero) {
      try {
        const { createEmployee } = await import('@/lib/xero/payroll');
        const config = await prisma.xeroPayrollConfig.findFirst();
        if (config?.tenantId) {
          const dob = staff.dateOfBirth ? staff.dateOfBirth.toISOString().slice(0, 10) : '1990-01-01';
          const addr = {
            addressLine1: staff.addressLine1 || 'Address TBC',
            city: staff.addressCity || 'Auckland',
            postCode: staff.addressPostCode || '1010',
            countryName: 'NEW ZEALAND',
          };
          const created = await createEmployee(config.tenantId, {
            firstName: staff.firstName,
            lastName: staff.lastName,
            dateOfBirth: dob,
            address: addr,
            email: staff.email,
          });
          const xeroId = (created as any)?.employees?.[0]?.employeeID;
          if (xeroId) {
            await prisma.staff.update({
              where: { id: staff.id },
              data: { xeroEmployeeId: xeroId },
            });
          }
        }
      } catch (xeroErr) {
        console.error('Xero create employee failed:', xeroErr);
      }
    }

    const finalStaff = await prisma.staff.findUnique({
      where: { id: staff.id },
      omit: { password: true, resetToken: true, resetTokenExpiry: true },
    });
    console.log(`✅ Created staff member: ${staff.firstName} ${staff.lastName}`);
    return NextResponse.json(finalStaff ?? staff, { status: 201 });
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
