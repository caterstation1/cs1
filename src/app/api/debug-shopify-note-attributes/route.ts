import { NextResponse } from 'next/server';
import { env } from '@/env.mjs';

export async function GET() {
  try {
    console.log('🔍 Debugging note attributes from Shopify API...');
    
    // Fetch recent orders from Shopify to check note_attributes
    const shopUrl = env.SHOPIFY_SHOP_URL;
    const accessToken = env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = env.SHOPIFY_API_VERSION;

    if (!shopUrl || !accessToken || !apiVersion) {
      throw new Error('Shopify credentials not configured');
    }

    const url = `https://${shopUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=10&order=created_at desc`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`📋 Found ${data.orders.length} orders from Shopify`);
    
    if (data.orders.length === 0) {
      return NextResponse.json({
        message: 'No orders found from Shopify',
        orders: []
      });
    }
    
    const shopifyNoteAttributesAnalysis = data.orders.map((order: any) => {
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
      totalOrders: data.orders.length,
      ordersWithNoteAttributes: shopifyNoteAttributesAnalysis.filter((o: any) => o.noteAttributes.hasData).length,
      ordersWithCity: shopifyNoteAttributesAnalysis.filter((o: any) => o.extractedCity).length,
      ordersWithDeliveryDate: shopifyNoteAttributesAnalysis.filter((o: any) => o.extractedDeliveryDate).length,
      ordersWithDeliveryTime: shopifyNoteAttributesAnalysis.filter((o: any) => o.extractedDeliveryTime).length,
      noteAttributesTypes: {
        array: shopifyNoteAttributesAnalysis.filter((o: any) => o.noteAttributes.isArray).length,
        null: shopifyNoteAttributesAnalysis.filter((o: any) => !o.noteAttributes.hasData).length
      }
    };
    
    return NextResponse.json({
      message: 'Shopify note attributes debug information',
      summary,
      orders: shopifyNoteAttributesAnalysis,
      totalOrders: data.orders.length
    });
    
  } catch (error) {
    console.error('❌ Error debugging Shopify note attributes:', error);
    return NextResponse.json({
      error: 'Failed to debug Shopify note attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
