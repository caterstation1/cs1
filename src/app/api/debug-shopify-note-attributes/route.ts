import { NextResponse } from 'next/server';
import { shopifyRestRequest } from '@/lib/shopify-client';

export async function GET() {
  try {
    console.log('🔍 Debugging note attributes from Shopify API...');
    
    // Fetch recent orders from Shopify to check note_attributes
    const response = await shopifyRestRequest<{ orders: any[] }>({
      method: 'GET',
      path: 'orders.json',
      query: {
        status: 'any',
        limit: '10',
        order: 'created_at desc'
      }
    });
    
    console.log(`📋 Found ${response.orders.length} orders from Shopify`);
    
    if (response.orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found from Shopify',
        orders: []
      });
    }
    
    const shopifyNoteAttributesAnalysis = response.orders.map(order => {
      const noteAttributes = order.note_attributes;
      let parsedNoteAttributes = null;
      
      // Parse note_attributes if it exists
      if (noteAttributes && Array.isArray(noteAttributes)) {
        parsedNoteAttributes = noteAttributes;
      }
      
      return {
        id: order.id,
        orderNumber: order.order_number,
        customerEmail: order.customer?.email,
        createdAt: order.created_at,
        noteAttributes: {
          raw: noteAttributes,
          type: typeof noteAttributes,
          isArray: Array.isArray(noteAttributes),
          parsed: parsedNoteAttributes,
          hasData: !!noteAttributes && Array.isArray(noteAttributes) && noteAttributes.length > 0
        },
        note: order.note,
        tags: order.tags,
        // Check if we can extract city from note attributes
        extractedCity: parsedNoteAttributes && Array.isArray(parsedNoteAttributes)
          ? parsedNoteAttributes.find((attr: any) => attr?.name?.toLowerCase() === 'city')?.value
          : null,
        // Check if we can extract delivery date from note attributes
        extractedDeliveryDate: parsedNoteAttributes && Array.isArray(parsedNoteAttributes)
          ? parsedNoteAttributes.find((attr: any) => attr?.name?.toLowerCase().includes('delivery date'))?.value
          : null,
        // Check if we can extract delivery time from note attributes
        extractedDeliveryTime: parsedNoteAttributes && Array.isArray(parsedNoteAttributes)
          ? parsedNoteAttributes.find((attr: any) => attr?.name?.toLowerCase().includes('delivery time'))?.value
          : null
      };
    });
    
    console.log('📊 Shopify note attributes analysis:', shopifyNoteAttributesAnalysis);
    
    // Summary statistics
    const summary = {
      totalOrders: response.orders.length,
      ordersWithNoteAttributes: shopifyNoteAttributesAnalysis.filter(o => o.noteAttributes.hasData).length,
      ordersWithCity: shopifyNoteAttributesAnalysis.filter(o => o.extractedCity).length,
      ordersWithDeliveryDate: shopifyNoteAttributesAnalysis.filter(o => o.extractedDeliveryDate).length,
      ordersWithDeliveryTime: shopifyNoteAttributesAnalysis.filter(o => o.extractedDeliveryTime).length,
      noteAttributesTypes: {
        array: shopifyNoteAttributesAnalysis.filter(o => o.noteAttributes.isArray).length,
        null: shopifyNoteAttributesAnalysis.filter(o => !o.noteAttributes.hasData).length
      }
    };
    
    return NextResponse.json({
      message: 'Shopify note attributes debug information',
      summary,
      orders: shopifyNoteAttributesAnalysis,
      totalOrders: response.orders.length
    });
    
  } catch (error) {
    console.error('❌ Error debugging Shopify note attributes:', error);
    return NextResponse.json({
      error: 'Failed to debug Shopify note attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
