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
    // Vercel cron jobs need to be configured with Authorization header in vercel.json
    // For now, we'll allow cron endpoints if CRON_SECRET is not set (for testing)
    // or if the Authorization header matches
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it. If not set, allow (for testing/Vercel built-in)
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.log('❌ Unauthorized cron request - CRON_SECRET required but header does not match');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log('⚠️ CRON_SECRET not set - allowing cron request (testing mode)');
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
    
    // Production times: 9:00 AM (540 minutes) or 3:15 PM (915 minutes)
    const is9AM = currentMinutes >= 540 && currentMinutes < 545; // 5 minute window
    const is315PM = currentMinutes >= 915 && currentMinutes < 920; // 5 minute window
    
    // Only allow production times
    if (!is9AM && !is315PM) {
      console.log(`⏰ Supplier email cron called but not scheduled time. Current NZ time: ${nzTime} (${currentMinutes} minutes)`);
      return NextResponse.json({ 
        message: 'Not scheduled time for supplier emails',
        currentTime: nzTime,
        currentMinutes,
        is9AM,
        is315PM
      });
    }
    
    console.log(`✅ Supplier email cron triggered at ${nzTime} (${currentMinutes} minutes) - ${is9AM ? '9:00 AM' : '3:15 PM'}`);
    
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
