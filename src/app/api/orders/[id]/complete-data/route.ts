import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shopifyRestRequest } from '@/lib/shopify-client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔍 Fetching complete data for order: ${id}`);
    
    // First, try to find the order in our database by order number or ID
    let order = null;
    let searchMethod = '';
    
    // Try by order number first (most common search)
    if (!isNaN(Number(id))) {
      order = await prisma.order.findFirst({
        where: {
          orderNumber: Number(id)
        }
      });
      searchMethod = 'orderNumber';
    }
    
    // If not found by order number, try by database ID
    if (!order) {
      order = await prisma.order.findUnique({
        where: {
          id: id
        }
      });
      searchMethod = 'databaseId';
    }
    
    // If still not found, try by Shopify ID
    if (!order) {
      order = await prisma.order.findFirst({
        where: {
          shopifyId: id
        }
      });
      searchMethod = 'shopifyId';
    }
    
    if (!order) {
      return NextResponse.json({
        error: 'Order not found',
        searchedFor: id,
        searchMethods: ['orderNumber', 'databaseId', 'shopifyId'],
        message: 'Order not found in database. Please check the order number or ID.'
      }, { status: 404 });
    }
    
    console.log(`✅ Found order using ${searchMethod}:`, order.orderNumber);
    
    // Now fetch the raw Shopify data for this order
    let shopifyData = null;
    let shopifyError = null;
    
    try {
      const shopifyResponse = await shopifyRestRequest<{ order: any }>({
        method: 'GET',
        path: `orders/${order.shopifyId}.json`
      });
      shopifyData = shopifyResponse.order;
      console.log('✅ Fetched Shopify data for order:', order.shopifyId);
    } catch (error) {
      console.error('❌ Error fetching Shopify data:', error);
      shopifyError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Parse note attributes if they exist
    let parsedNoteAttributes = null;
    if (order.noteAttributes) {
      try {
        if (typeof order.noteAttributes === 'string') {
          parsedNoteAttributes = JSON.parse(order.noteAttributes);
        } else {
          parsedNoteAttributes = order.noteAttributes;
        }
      } catch (e) {
        console.log('Failed to parse noteAttributes:', e);
      }
    }
    
    // Parse line items if they exist
    let parsedLineItems = null;
    if (order.lineItems) {
      try {
        if (typeof order.lineItems === 'string') {
          parsedLineItems = JSON.parse(order.lineItems);
        } else {
          parsedLineItems = order.lineItems;
        }
      } catch (e) {
        console.log('Failed to parse lineItems:', e);
      }
    }
    
    // Parse shipping address if it exists
    let parsedShippingAddress = null;
    if (order.shippingAddress) {
      try {
        if (typeof order.shippingAddress === 'string') {
          parsedShippingAddress = JSON.parse(order.shippingAddress);
        } else {
          parsedShippingAddress = order.shippingAddress;
        }
      } catch (e) {
        console.log('Failed to parse shippingAddress:', e);
      }
    }
    
    // Parse billing address if it exists
    let parsedBillingAddress = null;
    if (order.billingAddress) {
      try {
        if (typeof order.billingAddress === 'string') {
          parsedBillingAddress = JSON.parse(order.billingAddress);
        } else {
          parsedBillingAddress = order.billingAddress;
        }
      } catch (e) {
        console.log('Failed to parse billingAddress:', e);
      }
    }
    
    // Parse SMS history if it exists
    let parsedSmsHistory = null;
    if (order.smsHistory) {
      try {
        if (typeof order.smsHistory === 'string') {
          parsedSmsHistory = JSON.parse(order.smsHistory);
        } else {
          parsedSmsHistory = order.smsHistory;
        }
      } catch (e) {
        console.log('Failed to parse smsHistory:', e);
      }
    }
    
    // Extract key information from note attributes
    const extractedInfo = {
      city: null,
      deliveryDate: null,
      deliveryTime: null,
      pickupDate: null,
      pickupTime: null,
      specialInstructions: null
    };
    
    if (parsedNoteAttributes && Array.isArray(parsedNoteAttributes)) {
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
      searchInfo: {
        searchedFor: id,
        foundUsing: searchMethod,
        orderNumber: order.orderNumber,
        shopifyId: order.shopifyId,
        databaseId: order.id
      },
      
      // Database data (all fields)
      databaseData: {
        // Core order information
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
        
        // Customer information
        customerEmail: order.customerEmail,
        customerFirstName: order.customerFirstName,
        customerLastName: order.customerLastName,
        customerPhone: order.customerPhone,
        
        // Delivery information
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
        
        // Notes and attributes
        note: order.note,
        internalNote: order.internalNote,
        tags: order.tags,
        noteAttributes: parsedNoteAttributes,
        
        // Addresses
        shippingAddress: parsedShippingAddress,
        billingAddress: parsedBillingAddress,
        
        // Items and metadata
        lineItems: parsedLineItems,
        source: order.source,
        hasLocalEdits: order.hasLocalEdits,
        syncedAt: order.syncedAt,
        dbCreatedAt: order.dbCreatedAt,
        dbUpdatedAt: order.dbUpdatedAt
      },
      
      // Extracted information from note attributes
      extractedInfo,
      
      // Raw Shopify data (if available)
      shopifyData: shopifyData ? {
        id: shopifyData.id,
        order_number: shopifyData.order_number,
        created_at: shopifyData.created_at,
        updated_at: shopifyData.updated_at,
        processed_at: shopifyData.processed_at,
        cancelled_at: shopifyData.cancelled_at,
        closed_at: shopifyData.closed_at,
        total_price: shopifyData.total_price,
        subtotal_price: shopifyData.subtotal_price,
        total_tax: shopifyData.total_tax,
        currency: shopifyData.currency,
        financial_status: shopifyData.financial_status,
        fulfillment_status: shopifyData.fulfillment_status,
        note: shopifyData.note,
        tags: shopifyData.tags,
        note_attributes: shopifyData.note_attributes,
        customer: shopifyData.customer,
        shipping_address: shopifyData.shipping_address,
        billing_address: shopifyData.billing_address,
        line_items: shopifyData.line_items,
        shipping_lines: shopifyData.shipping_lines,
        // Include any other fields that might be present
        ...shopifyData
      } : null,
      
      // Error information
      shopifyError,
      
      // Data comparison
      dataComparison: {
        noteAttributesMatch: shopifyData ? 
          JSON.stringify(parsedNoteAttributes) === JSON.stringify(shopifyData.note_attributes) : 
          'No Shopify data to compare',
        deliveryDateMatch: shopifyData ? 
          order.deliveryDate === shopifyData.note_attributes?.find((attr: any) => 
            attr.name?.toLowerCase().includes('delivery date'))?.value : 
          'No Shopify data to compare',
        lastSyncAge: order.syncedAt ? 
          Math.round((Date.now() - new Date(order.syncedAt).getTime()) / (1000 * 60 * 60)) + ' hours ago' : 
          'Never synced'
      }
    };
    
    return NextResponse.json(completeData);
    
  } catch (error) {
    console.error('❌ Error fetching complete order data:', error);
    return NextResponse.json({
      error: 'Failed to fetch complete order data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
