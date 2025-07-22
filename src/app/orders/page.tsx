'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ProductEditModal, Product } from '@/components/ProductEditModal';

// Define the Order type based on our Prisma model
interface Order {
  id: string;
  shopifyId: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  tags: string | null;
  note: string | null;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string | null;
  shippingAddress: any | null;
  billingAddress: any | null;
  lineItems: any[];
  source: string;
  hasLocalEdits: boolean;
  syncedAt: string;
  dbCreatedAt: string;
  dbUpdatedAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; errors: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderData, setShowOrderData] = useState(false);
  
  // Product editing modal state
  const [productEditModal, setProductEditModal] = useState({
    isOpen: false,
    sku: '',
    productTitle: '',
    variantTitle: ''
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders');
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const syncOrders = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/orders/sync', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync orders');
      }
      
      const data = await response.json();
      setSyncResult(data.result);
      
      // Refresh orders after sync
      await fetchOrders();
    } catch (err) {
      console.error('Error syncing orders:', err);
      setError('Failed to sync orders. Please try again later.');
    } finally {
      setSyncing(false);
    }
  };

  // Extract phone number from tags or delivery instructions
  const extractPhoneNumber = (order: Order) => {
    let phone = order.customerPhone;
    
    // Try to get phone from tags
    if (order.tags) {
      const tags = order.tags.split(',');
      const phoneTag = tags.find(tag => tag.includes('Phone:'));
      if (phoneTag) {
        phone = phoneTag.split(':')[1].trim();
      }
    }
    
    // Try to get phone from delivery instructions in shipping address
    if (!phone && order.shippingAddress?.delivery_instructions) {
      const match = order.shippingAddress.delivery_instructions.match(/Phone:\s*([^;]+)/i);
      if (match) {
        phone = match[1].trim();
      }
    }
    
    return phone;
  };

  // Handle opening product edit modal
  const handleEditProduct = (sku: string, productTitle: string, variantTitle?: string) => {
    setProductEditModal({
      isOpen: true,
      sku,
      productTitle,
      variantTitle: variantTitle || ''
    });
  };

  // Handle product update callback
  const handleProductUpdated = (updatedProduct: Product) => {
    console.log('Product updated:', updatedProduct);
    // You could add a toast notification here
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">All Orders</h1>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">All Orders</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Orders</h1>
        <button
          onClick={syncOrders}
          disabled={syncing}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync Orders'}
        </button>
      </div>
      
      {syncResult && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <p>Sync completed: {syncResult.synced} orders synced, {syncResult.skipped} skipped, {syncResult.errors} errors</p>
        </div>
      )}
      
      {orders.length === 0 ? (
        <p className="text-gray-500">No orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left">Order #</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Customer</th>
                <th className="py-3 px-4 text-left">Items</th>
                <th className="py-3 px-4 text-left">Total</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4">{order.orderNumber}</td>
                  <td className="py-3 px-4">
                    {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-3 px-4">
                    {order.customerFirstName} {order.customerLastName}
                    <div className="text-sm text-gray-500">{order.customerEmail}</div>
                    <div className="text-sm text-gray-500">{extractPhoneNumber(order)}</div>
                  </td>
                  <td className="py-3 px-4">
                    {order.lineItems.map((item: any) => (
                      <ContextMenu key={item.id}>
                        <ContextMenuTrigger asChild>
                          <div className="text-sm cursor-context-menu hover:bg-gray-100 p-1 rounded">
                            {item.quantity}x {item.title}
                            {item.sku && (
                              <div className="text-xs text-gray-400">SKU: {item.sku}</div>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem 
                            onClick={() => handleEditProduct(item.sku, item.title, '')}
                            disabled={!item.sku}
                          >
                            Edit Product
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </td>
                  <td className="py-3 px-4">
                    {order.currency} {order.totalPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      order.fulfillmentStatus === 'fulfilled' 
                        ? 'bg-green-100 text-green-800' 
                        : order.fulfillmentStatus === 'partial' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {order.fulfillmentStatus || 'Unfulfilled'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowOrderData(true);
                      }}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      ALL DATA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showOrderData} onOpenChange={setShowOrderData}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.orderNumber} - Raw Data</DialogTitle>
            <DialogDescription>
              All available data for this order, including tags, attributes, and delivery instructions
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="mt-4 space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-medium text-sm text-gray-700">Phone Number Sources</h3>
                <pre className="mt-1 text-sm whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">
                  Customer Phone: {selectedOrder.customerPhone || 'Not provided'}
                  {selectedOrder.tags && `\nTags: ${selectedOrder.tags}`}
                  {selectedOrder.shippingAddress?.delivery_instructions && 
                    `\nDelivery Instructions: ${selectedOrder.shippingAddress.delivery_instructions}`}
                </pre>
              </div>
              
              {Object.entries(selectedOrder).map(([key, value]) => (
                <div key={key} className="border-b pb-2">
                  <h3 className="font-medium text-sm text-gray-700">{key}</h3>
                  <pre className="mt-1 text-sm whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
                Close
              </button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit Modal */}
      <ProductEditModal
        isOpen={productEditModal.isOpen}
        onClose={() => setProductEditModal({ isOpen: false, sku: '', productTitle: '', variantTitle: '' })}
        sku={productEditModal.sku}
        productTitle={productEditModal.productTitle}
        variantTitle={productEditModal.variantTitle}
        onProductUpdated={handleProductUpdated}
      />
    </div>
  );
} 