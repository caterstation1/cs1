import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/env.mjs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    console.log(`🔍 Fetching complete data for order number: ${orderNumber}`);
    
    // Find the order in our database by order number
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: Number(orderNumber)
      }
    });
    
    if (!order) {
      return NextResponse.json({
        error: 'Order not found',
        orderNumber: orderNumber,
        message: 'Order not found in database. Please check the order number.'
      }, { status: 404 });
    }
    
    console.log(`✅ Found order:`, order.orderNumber);
    
    // Fetch the raw Shopify data for this order
    let shopifyData = null;
    let shopifyError = null;
    
    try {
      const shopUrl = env.SHOPIFY_SHOP_URL;
      const accessToken = env.SHOPIFY_ACCESS_TOKEN;
      const apiVersion = env.SHOPIFY_API_VERSION;

      if (!shopUrl || !accessToken || !apiVersion) {
        throw new Error('Shopify credentials not configured');
      }

      const url = `https://${shopUrl}/admin/api/${apiVersion}/orders/${order.shopifyId}.json`;
      
      const shopifyResponse = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!shopifyResponse.ok) {
        throw new Error(`Shopify API error: ${shopifyResponse.statusText}`);
      }

      const shopifyResponseData = await shopifyResponse.json();
      shopifyData = shopifyResponseData.order;
      console.log('✅ Fetched Shopify data for order:', order.shopifyId);
    } catch (error) {
      console.error('❌ Error fetching Shopify data:', error);
      shopifyError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Parse all JSON fields
    const parseJsonField = (field: any) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          return field;
        }
      }
      return field;
    };
    
    const parsedNoteAttributes = parseJsonField(order.noteAttributes);
    const parsedLineItems = parseJsonField(order.lineItems);
    const parsedShippingAddress = parseJsonField(order.shippingAddress);
    const parsedBillingAddress = parseJsonField(order.billingAddress);
    const parsedSmsHistory = parseJsonField(order.smsHistory);
    
    // Extract key information from note attributes
    const extractedInfo = {
      city: null,
      deliveryDate: null,
      deliveryTime: null,
      pickupDate: null,
      pickupTime: null,
      specialInstructions: null,
      allAttributes: [] as any[]
    };
    
    if (parsedNoteAttributes && Array.isArray(parsedNoteAttributes)) {
      extractedInfo.allAttributes = parsedNoteAttributes;
      parsedNoteAttributes.forEach((attr: any) => {
        if (attr?.name && attr?.value) {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          
          if (name.includes('city')) {
            extractedInfo.city = value;
          } else if (name.includes('delivery date')) {
            extractedInfo.deliveryDate = value;
          } else if (name.includes('delivery time')) {
            extractedInfo.deliveryTime = value;
          } else if (name.includes('pickup date')) {
            extractedInfo.pickupDate = value;
          } else if (name.includes('pickup time')) {
            extractedInfo.pickupTime = value;
          } else if (name.includes('instruction') || name.includes('note')) {
            extractedInfo.specialInstructions = value;
          }
        }
      });
    }
    
    // Build comprehensive response
    const completeData = {
      // Search info
      searchInfo: {
        orderNumber: order.orderNumber,
        shopifyId: order.shopifyId,
        databaseId: order.id,
        foundAt: new Date().toISOString()
      },
      
      // Quick summary
      summary: {
        customer: `${order.customerFirstName} ${order.customerLastName}`,
        email: order.customerEmail,
        phone: order.customerPhone,
        total: `$${order.totalPrice.toFixed(2)} ${order.currency}`,
        status: order.fulfillmentStatus || 'Unfulfilled',
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        city: extractedInfo.city,
        isDispatched: order.isDispatched
      },
      
      // All database fields
      database: {
        // Core fields
        id: order.id,
        shopifyId: order.shopifyId,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        processedAt: order.processedAt,
        cancelledAt: order.cancelledAt,
        closedAt: order.closedAt,
        
        // Pricing
        totalPrice: order.totalPrice,
        subtotalPrice: order.subtotalPrice,
        totalTax: order.totalTax,
        currency: order.currency,
        
        // Status
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        
        // Customer
        customerEmail: order.customerEmail,
        customerFirstName: order.customerFirstName,
        customerLastName: order.customerLastName,
        customerPhone: order.customerPhone,
        
        // Delivery
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        deliveryDateResolved: order.deliveryDateResolved,
        deliveryDateResolvedSource: order.deliveryDateResolvedSource,
        deliveryDateResolvedAt: order.deliveryDateResolvedAt,
        deliveryInstructions: order.deliveryInstructions,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        leaveTime: order.leaveTime,
        travelTime: order.travelTime,
        driverId: order.driverId,
        isDispatched: order.isDispatched,
        
        // Communication
        lastSmsSent: order.lastSmsSent,
        smsHistory: parsedSmsHistory,
        
        // Notes
        note: order.note,
        internalNote: order.internalNote,
        tags: order.tags,
        noteAttributes: parsedNoteAttributes,
        
        // Addresses
        shippingAddress: parsedShippingAddress,
        billingAddress: parsedBillingAddress,
        
        // Items
        lineItems: parsedLineItems,
        
        // Metadata
        source: order.source,
        hasLocalEdits: order.hasLocalEdits,
        syncedAt: order.syncedAt,
        dbCreatedAt: order.dbCreatedAt,
        dbUpdatedAt: order.dbUpdatedAt
      },
      
      // Extracted information
      extracted: extractedInfo,
      
      // Raw Shopify data
      shopify: shopifyData || null,
      
      // Errors
      errors: {
        shopify: shopifyError
      },
      
      // Data comparison
      comparison: {
        noteAttributesMatch: shopifyData ? 
          JSON.stringify(parsedNoteAttributes) === JSON.stringify(shopifyData.note_attributes) : 
          'No Shopify data',
        lastSyncAge: order.syncedAt ? 
          Math.round((Date.now() - new Date(order.syncedAt).getTime()) / (1000 * 60 * 60)) + ' hours ago' : 
          'Never synced'
      }
    };
    
    return NextResponse.json(completeData);
    
  } catch (error) {
    console.error('❌ Error fetching order data:', error);
    return NextResponse.json({
      error: 'Failed to fetch order data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
