import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { formatNZYMD, getNZDateRangeForYmd, addDaysNZ } from '@/lib/date-utils';
import { format } from 'date-fns';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Helper: Parse time string to minutes since midnight
function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  // Handle 24-hour format (HH:mm)
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  // Handle 12-hour format (H:MM AM/PM)
  const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return null;
}

// Helper: Calculate dispatch time from delivery time and travel time
function getDispatchTimeMinutes(order: any): number | null {
  const deliveryTime = order.deliveryTime;
  if (!deliveryTime) return null;
  
  const deliveryMinutes = parseTimeToMinutes(deliveryTime);
  if (deliveryMinutes === null) return null;
  
  const travelTimeMinutes = order.travelTime ? parseInt(order.travelTime, 10) : 0;
  return deliveryMinutes - travelTimeMinutes;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Allow internal calls from cron (skip auth check for internal)
    const authHeader = request.headers.get('authorization');
    const isInternal = authHeader === `Bearer ${process.env.CRON_SECRET || 'internal'}`;
    // For external calls, could add auth check here if needed
    
    const { id } = await params;
    
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });
    
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
    
    if (!supplier.contactEmail) {
      return NextResponse.json({ error: 'Supplier has no contact email' }, { status: 400 });
    }
    
    const emailSettings = (supplier.emailSettings as any) || {};
    if (!emailSettings.bakery?.enabled) {
      return NextResponse.json({ error: 'Bakery emails not enabled for this supplier' }, { status: 400 });
    }
    
    // Get today in NZ timezone
    const today = new Date();
    const todayNZ = formatNZYMD(today);
    const tomorrowNZ = addDaysNZ(todayNZ, 1);
    const dayAfterNZ = addDaysNZ(todayNZ, 2);
    
    // Fetch orders for tomorrow and day after
    const { start: tomorrowStart, end: tomorrowEnd } = getNZDateRangeForYmd(tomorrowNZ);
    const { start: dayAfterStart, end: dayAfterEnd } = getNZDateRangeForYmd(dayAfterNZ);
    
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { deliveryDateResolved: { gte: tomorrowStart, lte: tomorrowEnd } },
          { deliveryDateResolved: { gte: dayAfterStart, lte: dayAfterEnd } }
        ]
      },
      orderBy: { deliveryTime: 'asc' }
    });
    
    // Get all bakery products
    const bakeryProducts = await prisma.shopifyProduct.findMany({
      where: { bakery: true },
      include: { variants: true }
    });
    
    const bakeryVariantIds = new Set<string>();
    bakeryProducts.forEach(product => {
      product.variants.forEach(variant => {
        bakeryVariantIds.add(variant.variantId);
      });
    });
    
    // Parse line items and filter bakery items
    const parseLineItems = (li: any): any[] => {
      if (Array.isArray(li)) return li;
      if (typeof li === 'string') {
        try { return JSON.parse(li) } catch {}
      }
      return [];
    };
    
    // Group bakery items by date and AM/PM
    const tomorrowAM: Record<string, number> = {};
    const tomorrowPM: Record<string, number> = {};
    const dayAfterCombined: Record<string, number> = {};
    
    const AM_CUTOFF = 13 * 60 + 35; // 1:35 PM in minutes
    
    for (const order of orders) {
      const deliveryDate = order.deliveryDateResolved 
        ? formatNZYMD(new Date(order.deliveryDateResolved))
        : order.deliveryDate;
      
      if (!deliveryDate) continue;
      
      const isTomorrow = deliveryDate === tomorrowNZ;
      const isDayAfter = deliveryDate === dayAfterNZ;
      
      if (!isTomorrow && !isDayAfter) continue;
      
      const dispatchMinutes = getDispatchTimeMinutes(order);
      const isAM = dispatchMinutes !== null && dispatchMinutes < AM_CUTOFF;
      
      const lineItems = parseLineItems(order.lineItems);
      
      for (const item of lineItems) {
        const variantId = String(item.variant_id || item.variantId || '');
        if (!bakeryVariantIds.has(variantId)) continue;
        
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) continue;
        
        // Get display name from variant
        let displayName = item.title || item.name || 'Unknown Item';
        for (const product of bakeryProducts) {
          const variant = product.variants.find(v => v.variantId === variantId);
          if (variant) {
            displayName = variant.displayName || variant.shopifyName || displayName;
            break;
          }
        }
        
        if (isTomorrow) {
          if (isAM) {
            tomorrowAM[displayName] = (tomorrowAM[displayName] || 0) + quantity;
          } else {
            tomorrowPM[displayName] = (tomorrowPM[displayName] || 0) + quantity;
          }
        } else if (isDayAfter) {
          dayAfterCombined[displayName] = (dayAfterCombined[displayName] || 0) + quantity;
        }
      }
    }
    
    // Build email content
    const formatDate = (ymd: string) => {
      const [year, month, day] = ymd.split('-').map(Number);
      return format(new Date(year, month - 1, day), 'dd/MM/yyyy');
    };
    
    let emailBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">Bakery Order</h2>
      <h3 style="margin-top: 20px;">Order for Tomorrow ${formatDate(tomorrowNZ)}</h3>`;
    
    if (Object.keys(tomorrowAM).length > 0) {
      emailBody += `<h4 style="margin-top: 15px;">AM - Pick up</h4><ul>`;
      for (const [name, qty] of Object.entries(tomorrowAM)) {
        emailBody += `<li>${qty} x ${name}</li>`;
      }
      emailBody += `</ul>`;
    }
    
    if (Object.keys(tomorrowPM).length > 0) {
      emailBody += `<h4 style="margin-top: 15px;">PM - Pick up</h4><ul>`;
      for (const [name, qty] of Object.entries(tomorrowPM)) {
        emailBody += `<li>${qty} x ${name}</li>`;
      }
      emailBody += `</ul>`;
    }
    
    if (Object.keys(tomorrowAM).length === 0 && Object.keys(tomorrowPM).length === 0) {
      emailBody += `<p>No bakery items for tomorrow.</p>`;
    }
    
    emailBody += `<h3 style="margin-top: 30px;">Following Day ${formatDate(dayAfterNZ)}</h3>`;
    emailBody += `<p>Combined AM/PM pick up</p>`;
    
    if (Object.keys(dayAfterCombined).length > 0) {
      emailBody += `<ul>`;
      for (const [name, qty] of Object.entries(dayAfterCombined)) {
        emailBody += `<li>${qty} x ${name}</li>`;
      }
      emailBody += `</ul>`;
    } else {
      emailBody += `<p>No bakery items for the following day.</p>`;
    }
    
    emailBody += `</div>`;
    
    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: supplier.contactEmail,
      subject: `Bakery Order - ${formatDate(tomorrowNZ)} & ${formatDate(dayAfterNZ)}`,
      html: emailBody
    });
    
    console.log(`✅ Bakery order email sent to ${supplier.contactEmail}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Email sent successfully',
      tomorrow: {
        am: tomorrowAM,
        pm: tomorrowPM
      },
      dayAfter: dayAfterCombined
    });
  } catch (error) {
    console.error('❌ Error sending bakery email:', error);
    return NextResponse.json(
      { error: 'Failed to send bakery email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
