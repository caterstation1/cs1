import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { formatNZYMD, getNZDateRangeForYmd, addDaysNZ } from '@/lib/date-utils';
import { format } from 'date-fns';
import { resolveBundleItems } from '@/lib/product-service';

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
    const runType = (request.nextUrl.searchParams.get('run') || '').toLowerCase();
    const isFinalRun = runType === 'final';
    // Allow internal calls from cron (skip auth check for internal)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it for internal calls. If not set, allow (for testing)
    if (cronSecret) {
      const isInternal = authHeader === `Bearer ${cronSecret}`;
      if (!isInternal) {
        console.log('❌ Unauthorized send-bakery-email request - CRON_SECRET required');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log('⚠️ CRON_SECRET not set - allowing send-bakery-email request (testing mode)');
    }
    
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

    // Parse line items helper function
    const parseLineItems = (li: any): any[] => {
      if (Array.isArray(li)) return li;
      if (typeof li === 'string') {
        try { return JSON.parse(li) } catch {}
      }
      return [];
    };

    // Build products map for bundle resolution
    const allVariantIds = new Set<string>();
    for (const o of orders) {
      const lineItems = parseLineItems(o.lineItems);
      lineItems.forEach((it: any) => {
        const variantId = it.variant_id?.toString() || it.variantId?.toString();
        if (variantId) allVariantIds.add(variantId);
      });
    }

    // Fetch all product variants
    const productVariants = await prisma.productVariant.findMany({
      where: { variantId: { in: Array.from(allVariantIds) } },
      include: { product: true }
    });
    const productsMap: Record<string, any> = {};
    productVariants.forEach(v => {
      productsMap[v.variantId] = {
        ...v,
        isPartyPack: v.isPartyPack,
        bundleItems: v.bundleItems,
        productIsPartyPackDefault: v.product.isPartyPackDefault,
        productBundleDefaultItems: v.product.bundleDefaultItems
      };
    });

    // Fetch child variants that might be in bundles
    const childVariantIds = new Set<string>();
    productVariants.forEach(v => {
      const children = resolveBundleItems({
        ...v,
        isPartyPack: v.isPartyPack,
        bundleItems: v.bundleItems,
        productIsPartyPackDefault: v.product.isPartyPackDefault,
        productBundleDefaultItems: v.product.bundleDefaultItems
      });
      children.forEach(c => childVariantIds.add(c.variantId));
    });
    
    if (childVariantIds.size > 0) {
      const childVariants = await prisma.productVariant.findMany({
        where: { variantId: { in: Array.from(childVariantIds) } },
        include: { product: true }
      });
      childVariants.forEach(v => {
        productsMap[v.variantId] = {
          ...v,
          isPartyPack: v.isPartyPack,
          bundleItems: v.bundleItems,
          productIsPartyPackDefault: v.product.isPartyPackDefault,
          productBundleDefaultItems: v.product.bundleDefaultItems
        };
      });
    }
    
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
      
      // Expand party packs into their nested products
      const expandedItems: any[] = [];
      for (const item of lineItems) {
        const variantId = String(item.variant_id || item.variantId || '');
        const product = productsMap[variantId];
        const qty = Number(item.quantity || 0);
        
        if (product) {
          const bundleChildren = resolveBundleItems(product);
          if (bundleChildren.length > 0) {
            // This is a party pack - expand it
            for (const child of bundleChildren) {
              const childProduct = productsMap[child.variantId];
              expandedItems.push({
                ...item,
                variant_id: child.variantId,
                variantId: child.variantId,
                quantity: qty * Math.max(1, parseInt(String(child.quantity || '1'), 10)),
                title: childProduct?.displayName || childProduct?.shopifyName || item.title,
                _isPackChild: true
              });
            }
          } else {
            // Not a party pack, add as-is
            expandedItems.push(item);
          }
        } else {
          // Product not found, add as-is
          expandedItems.push(item);
        }
      }
      
      for (const item of expandedItems) {
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
      subject: `${isFinalRun ? 'FINAL - ' : ''}Bakery Order - ${formatDate(tomorrowNZ)} & ${formatDate(dayAfterNZ)}`,
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
