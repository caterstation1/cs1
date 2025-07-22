import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Rate limiting setup
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100; // max requests per minute
const requests = new Map<string, number>();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('Updating order:', id);
  console.time(`[API] PATCH /api/orders/${id}`);
  const start = Date.now();
  
  try {
    // Check rate limit
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    // Clean up old entries
    for (const [timestamp] of requests) {
      if (parseInt(timestamp) < windowStart) {
        requests.delete(timestamp);
      }
    }
    
    // Count recent requests
    const recentRequests = Array.from(requests.values()).reduce((a, b) => a + b, 0);
    
    if (recentRequests >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    
    // Record this request
    requests.set(now.toString(), (requests.get(now.toString()) || 0) + 1);

    const body = await request.json();
    console.log('PATCH payload:', body);

    const order = await prisma.order.update({
      where: { id },
      data: body
    });

    console.log('Order after update:', order);
    const end = Date.now();
    console.timeEnd(`[API] PATCH /api/orders/${id}`);
    console.log(`[TIMING] PATCH handler duration: ${end - start}ms`);
    return NextResponse.json(order);
  } catch (error) {
    console.error(`Error updating order ${id}:`, error);
    console.timeEnd(`[API] PATCH /api/orders/${id}`);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
} 