import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Call the send-bakery-email endpoint internally
async function sendBakeryEmailForSupplier(supplierId: string) {
  // Use VERCEL_URL in production, or construct from environment variables
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_APP_URL || process.env.PRODUCTION_URL || 'https://caterstation1.vercel.app');
  
  console.log(`🔗 Calling send-bakery-email for supplier ${supplierId} via ${baseUrl}`);
  
  const response = await fetch(`${baseUrl}/api/suppliers/${supplierId}/send-bakery-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET || 'internal'}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error(`❌ HTTP error ${response.status} calling send-bakery-email:`, error);
    throw new Error(error.error || `Failed to send email (HTTP ${response.status})`);
  }
  
  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    // Vercel cron jobs can send Authorization header, but we also check for Vercel's cron secret header
    const authHeader = request.headers.get('authorization');
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret'); // Vercel's built-in header
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow if either Authorization header matches OR Vercel's cron secret matches
    const isAuthorized = 
      (authHeader === `Bearer ${cronSecret}`) ||
      (vercelCronSecret === cronSecret) ||
      (process.env.VERCEL === '1' && !cronSecret); // In Vercel, if no CRON_SECRET set, allow (for testing)
    
    if (!isAuthorized && cronSecret) {
      console.log('❌ Unauthorized cron request:', {
        hasAuthHeader: !!authHeader,
        hasVercelCronSecret: !!vercelCronSecret,
        cronSecretSet: !!cronSecret
      });
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
    
    // TESTING MODE: Check if it's every 10 minutes (:10, :20, :30, :40, :50, :00)
    // This allows testing at 1:10pm, 1:20pm, 1:30pm, etc.
    const isTestTime = minutes % 10 === 0;
    
    // Production times: 9:00 AM (540 minutes) or 3:15 PM (915 minutes)
    const is9AM = currentMinutes >= 540 && currentMinutes < 545; // 5 minute window
    const is315PM = currentMinutes >= 915 && currentMinutes < 920; // 5 minute window
    
    // Allow either test time OR production times
    if (!isTestTime && !is9AM && !is315PM) {
      console.log(`⏰ Supplier email cron called but not scheduled time. Current NZ time: ${nzTime} (${currentMinutes} minutes)`);
      return NextResponse.json({ 
        message: 'Not scheduled time for supplier emails',
        currentTime: nzTime,
        currentMinutes,
        isTestTime,
        is9AM,
        is315PM
      });
    }
    
    console.log(`✅ Supplier email cron triggered at ${nzTime} (${currentMinutes} minutes) - Test mode: ${isTestTime}, Production: ${is9AM || is315PM}`);
    
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
      console.log('⚠️ No suppliers with bakery emails enabled');
      return NextResponse.json({ message: 'No suppliers with bakery emails enabled' });
    }
    
    console.log(`📧 Found ${suppliers.length} supplier(s) with bakery emails enabled:`, suppliers.map(s => s.name));
    
    const results = [];
    
    for (const supplier of suppliers) {
      try {
        console.log(`📤 Sending bakery email to ${supplier.name} (${supplier.contactEmail})...`);
        await sendBakeryEmailForSupplier(supplier.id);
        console.log(`✅ Successfully sent email to ${supplier.name}`);
        results.push({ supplier: supplier.name, status: 'success' });
      } catch (error) {
        console.error(`❌ Failed to send email to ${supplier.name}:`, error);
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
      trigger: isTestTime ? `Test mode (${nzTime})` : (is9AM ? '9:00 AM' : '3:15 PM'),
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
