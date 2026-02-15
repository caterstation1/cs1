import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Call the send-bakery-email endpoint internally
async function sendBakeryEmailForSupplier(supplierId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PRODUCTION_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/suppliers/${supplierId}/send-bakery-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET || 'internal'}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to send email');
  }
  
  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current time in NZ
    const now = new Date();
    const nzTime = now.toLocaleString('en-NZ', { 
      timeZone: 'Pacific/Auckland',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const [hours, minutes] = nzTime.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    
    // Check if it's 9:00 AM (540 minutes) or 3:15 PM (915 minutes)
    const is9AM = currentMinutes >= 540 && currentMinutes < 545; // 5 minute window
    const is315PM = currentMinutes >= 915 && currentMinutes < 920; // 5 minute window
    
    if (!is9AM && !is315PM) {
      return NextResponse.json({ 
        message: 'Not scheduled time for supplier emails',
        currentTime: nzTime,
        currentMinutes
      });
    }
    
    // Get all suppliers with bakery emails enabled
    const allSuppliers = await prisma.supplier.findMany({
      where: {
        contactEmail: { not: null }
      }
    });
    
    // Filter suppliers with bakery enabled (manual check since Prisma JSON filtering is complex)
    const suppliers = allSuppliers.filter(s => {
      const settings = (s.emailSettings as any) || {};
      return settings.bakery?.enabled === true;
    });
    
    if (suppliers.length === 0) {
      return NextResponse.json({ message: 'No suppliers with bakery emails enabled' });
    }
    
    const results = [];
    
    for (const supplier of suppliers) {
      try {
        await sendBakeryEmailForSupplier(supplier.id);
        results.push({ supplier: supplier.name, status: 'success' });
      } catch (error) {
        results.push({ 
          supplier: supplier.name, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      time: nzTime,
      trigger: is9AM ? '9:00 AM' : '3:15 PM',
      suppliersProcessed: results.length,
      results
    });
  } catch (error) {
    console.error('❌ Error in supplier emails cron:', error);
    return NextResponse.json(
      { error: 'Failed to process supplier emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
