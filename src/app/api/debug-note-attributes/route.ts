import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Debugging note attributes from PostgreSQL...');
    
    // Get a sample of orders to analyze note attributes
    const orders = await prisma.order.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        orderNumber: true,
        shopifyId: true,
        noteAttributes: true,
        note: true,
        tags: true,
        deliveryDate: true,
        deliveryTime: true,
        customerEmail: true,
        createdAt: true
      }
    });
    
    console.log(`📋 Found ${orders.length} orders for note attributes analysis`);
    
    if (orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found in database',
        orders: []
      });
    }
    
    const noteAttributesAnalysis = orders.map(order => {
      const noteAttributes = order.noteAttributes;
      let parsedNoteAttributes = null;
      
      // Try to parse noteAttributes if it's a string
      if (typeof noteAttributes === 'string') {
        try {
          parsedNoteAttributes = JSON.parse(noteAttributes);
        } catch (e) {
          console.log(`Failed to parse noteAttributes for order ${order.orderNumber}:`, e);
        }
      } else if (Array.isArray(noteAttributes)) {
        parsedNoteAttributes = noteAttributes;
      } else if (noteAttributes && typeof noteAttributes === 'object') {
        parsedNoteAttributes = noteAttributes;
      }
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        shopifyId: order.shopifyId,
        customerEmail: order.customerEmail,
        createdAt: order.createdAt,
        noteAttributes: {
          raw: noteAttributes,
          type: typeof noteAttributes,
          isArray: Array.isArray(noteAttributes),
          parsed: parsedNoteAttributes,
          hasData: !!noteAttributes && noteAttributes !== 'null' && noteAttributes !== '[]'
        },
        note: order.note,
        tags: order.tags,
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        // Check if we can extract city from note attributes
        extractedCity: parsedNoteAttributes && Array.isArray(parsedNoteAttributes) 
          ? parsedNoteAttributes.find((attr: any) => attr?.name?.toLowerCase() === 'city')?.value
          : null,
        // Check if we can extract delivery date from note attributes
        extractedDeliveryDate: parsedNoteAttributes && Array.isArray(parsedNoteAttributes)
          ? parsedNoteAttributes.find((attr: any) => attr?.name?.toLowerCase().includes('delivery date'))?.value
          : null
      };
    });
    
    console.log('📊 Note attributes analysis:', noteAttributesAnalysis);
    
    // Summary statistics
    const summary = {
      totalOrders: orders.length,
      ordersWithNoteAttributes: noteAttributesAnalysis.filter(o => o.noteAttributes.hasData).length,
      ordersWithParsedNoteAttributes: noteAttributesAnalysis.filter(o => o.noteAttributes.parsed).length,
      ordersWithCity: noteAttributesAnalysis.filter(o => o.extractedCity).length,
      ordersWithDeliveryDate: noteAttributesAnalysis.filter(o => o.extractedDeliveryDate).length,
      noteAttributesTypes: {
        string: noteAttributesAnalysis.filter(o => o.noteAttributes.type === 'string').length,
        object: noteAttributesAnalysis.filter(o => o.noteAttributes.type === 'object').length,
        array: noteAttributesAnalysis.filter(o => o.noteAttributes.isArray).length,
        null: noteAttributesAnalysis.filter(o => !o.noteAttributes.hasData).length
      }
    };
    
    return NextResponse.json({
      message: 'Note attributes debug information',
      summary,
      orders: noteAttributesAnalysis,
      totalOrders: orders.length
    });
    
  } catch (error) {
    console.error('❌ Error debugging note attributes:', error);
    return NextResponse.json({
      error: 'Failed to debug note attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
