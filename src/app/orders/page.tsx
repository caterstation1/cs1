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
  // Additional fields for editing
  deliveryDate?: string;
  deliveryTime?: string;
  leaveTime?: string;
  travelTime?: string;
  internalNote?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; errors: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderData, setShowOrderData] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // Product editing modal state
  const [productEditModal, setProductEditModal] = useState({
    isOpen: false,
    sku: '',
    productTitle: '',
    variantTitle: ''
  });

  const fetchOrders = async (search?: string, offset = 0) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: offset.toString()
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const response = await fetch(`/api/orders?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data.orders);
      setPagination(data.pagination);
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

  // Handle search
  const handleSearch = async () => {
    setIsSearching(true);
    try {
      await fetchOrders(searchTerm, 0);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle pagination
  const handleLoadMore = async () => {
    if (pagination.hasMore) {
      await fetchOrders(searchTerm, pagination.offset + pagination.limit);
    }
  };

  // Handle order update
  const handleOrderUpdate = async (orderId: string, updates: Partial<Order>) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order');
      }
      
      const updatedOrder = await response.json();
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, ...updatedOrder } : order));
      
      // Close edit modal
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Error updating order:', err);
      setError('Failed to update order. Please try again.');
    }
  };

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

      {/* Search Interface */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Orders
            </label>
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order number, name, email, phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                fetchOrders();
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {orders.length} of {pagination.total} orders
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsEditModalOpen(true);
                        }}
                        className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowOrderData(true);
                        }}
                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                      >
                        ALL DATA
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More Button */}
      {pagination.hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Load More Orders
          </button>
        </div>
      )}

      {/* Edit Order Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Order #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Update order details. Changes will be saved to the database.
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    defaultValue={selectedOrder.deliveryDate || ''}
                    onChange={(e) => {
                      const updatedOrder = { ...selectedOrder, deliveryDate: e.target.value };
                      setSelectedOrder(updatedOrder);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    defaultValue={selectedOrder.deliveryTime || ''}
                    onChange={(e) => {
                      const updatedOrder = { ...selectedOrder, deliveryTime: e.target.value };
                      setSelectedOrder(updatedOrder);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Time
                  </label>
                  <input
                    type="time"
                    defaultValue={selectedOrder.leaveTime || ''}
                    onChange={(e) => {
                      const updatedOrder = { ...selectedOrder, leaveTime: e.target.value };
                      setSelectedOrder(updatedOrder);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Travel Time (minutes)
                  </label>
                  <input
                    type="number"
                    defaultValue={selectedOrder.travelTime || ''}
                    onChange={(e) => {
                      const updatedOrder = { ...selectedOrder, travelTime: e.target.value };
                      setSelectedOrder(updatedOrder);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Notes
                </label>
                <textarea
                  defaultValue={selectedOrder.note || ''}
                  onChange={(e) => {
                    const updatedOrder = { ...selectedOrder, note: e.target.value };
                    setSelectedOrder(updatedOrder);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Note
                </label>
                <textarea
                  defaultValue={selectedOrder.internalNote || ''}
                  onChange={(e) => {
                    const updatedOrder = { ...selectedOrder, internalNote: e.target.value };
                    setSelectedOrder(updatedOrder);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedOrder) {
                  handleOrderUpdate(selectedOrder.id, selectedOrder);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderData} onOpenChange={setShowOrderData}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.orderNumber} - Complete Data</DialogTitle>
            <DialogDescription>
              All available data for this order, including all database fields, attributes, and metadata
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="mt-4 space-y-6">
              {/* Quick Reference Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">📋 Quick Reference</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Customer:</span> {selectedOrder.customerFirstName} {selectedOrder.customerLastName}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span> {selectedOrder.customerPhone || 'Not provided'}
                  </div>
                  <div>
                    <span className="font-medium">Delivery Date:</span> {selectedOrder.deliveryDate || 'Not set'}
                  </div>
                  <div>
                    <span className="font-medium">Delivery Time:</span> {selectedOrder.deliveryTime || 'Not set'}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {selectedOrder.fulfillmentStatus || 'Unfulfilled'}
                  </div>
                  <div>
                    <span className="font-medium">Total:</span> ${selectedOrder.totalPrice?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>

              {/* Core Order Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🏷️ Core Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'id', label: 'Database ID', description: 'Unique database identifier' },
                    { key: 'shopifyId', label: 'Shopify ID', description: 'Shopify order identifier' },
                    { key: 'orderNumber', label: 'Order Number', description: 'Human-readable order number' },
                    { key: 'source', label: 'Source', description: 'Order source (e.g., shopify)' },
                    { key: 'currency', label: 'Currency', description: 'Order currency' },
                    { key: 'financialStatus', label: 'Financial Status', description: 'Payment status' },
                    { key: 'fulfillmentStatus', label: 'Fulfillment Status', description: 'Shipping/fulfillment status' },
                    { key: 'hasLocalEdits', label: 'Has Local Edits', description: 'Whether order has been modified locally' },
                    { key: 'isDispatched', label: 'Is Dispatched', description: 'Whether order has been dispatched' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                        {selectedOrder[key as keyof typeof selectedOrder]?.toString() || 'null'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">💰 Pricing Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: 'totalPrice', label: 'Total Price', description: 'Final order total' },
                    { key: 'subtotalPrice', label: 'Subtotal Price', description: 'Price before tax' },
                    { key: 'totalTax', label: 'Total Tax', description: 'Tax amount' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                        ${selectedOrder[key as keyof typeof selectedOrder]?.toString() || '0.00'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">👤 Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'customerEmail', label: 'Email', description: 'Customer email address' },
                    { key: 'customerFirstName', label: 'First Name', description: 'Customer first name' },
                    { key: 'customerLastName', label: 'Last Name', description: 'Customer last name' },
                    { key: 'customerPhone', label: 'Phone', description: 'Customer phone number' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                        {selectedOrder[key as keyof typeof selectedOrder]?.toString() || 'null'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🚚 Delivery Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'deliveryDate', label: 'Delivery Date', description: 'Scheduled delivery date' },
                    { key: 'deliveryTime', label: 'Delivery Time', description: 'Scheduled delivery time' },
                    { key: 'deliveryDateResolved', label: 'Resolved Delivery Date', description: 'Server-computed delivery date' },
                    { key: 'deliveryDateResolvedSource', label: 'Resolved Source', description: 'How delivery date was determined' },
                    { key: 'deliveryDateResolvedAt', label: 'Resolved At', description: 'When delivery date was computed' },
                    { key: 'deliveryInstructions', label: 'Delivery Instructions', description: 'Special delivery instructions' },
                    { key: 'pickupDate', label: 'Pickup Date', description: 'Scheduled pickup date' },
                    { key: 'pickupTime', label: 'Pickup Time', description: 'Scheduled pickup time' },
                    { key: 'leaveTime', label: 'Leave Time', description: 'When to leave for delivery' },
                    { key: 'travelTime', label: 'Travel Time', description: 'Estimated travel time in minutes' },
                    { key: 'driverId', label: 'Driver ID', description: 'Assigned driver identifier' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                        {selectedOrder[key as keyof typeof selectedOrder]?.toString() || 'null'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📍 Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-700">Shipping Address</h4>
                      <span className="text-xs text-gray-500">shippingAddress</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Customer shipping address</p>
                    <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                      {selectedOrder.shippingAddress ? JSON.stringify(selectedOrder.shippingAddress, null, 2) : 'null'}
                    </pre>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-700">Billing Address</h4>
                      <span className="text-xs text-gray-500">billingAddress</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Customer billing address</p>
                    <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                      {selectedOrder.billingAddress ? JSON.stringify(selectedOrder.billingAddress, null, 2) : 'null'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📦 Order Items</h3>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm text-gray-700">Line Items</h4>
                    <span className="text-xs text-gray-500">lineItems</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Order line items and products</p>
                  <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-48">
                    {selectedOrder.lineItems ? JSON.stringify(selectedOrder.lineItems, null, 2) : 'null'}
                  </pre>
                </div>
              </div>

              {/* Notes and Attributes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📝 Notes and Attributes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'note', label: 'Order Note', description: 'Customer order notes' },
                    { key: 'internalNote', label: 'Internal Note', description: 'Internal staff notes' },
                    { key: 'tags', label: 'Tags', description: 'Order tags and labels' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded min-h-[2rem]">
                        {selectedOrder[key as keyof typeof selectedOrder]?.toString() || 'null'}
                      </div>
                    </div>
                  ))}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-700">Note Attributes</h4>
                      <span className="text-xs text-gray-500">noteAttributes</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Shopify note attributes (city, delivery date, etc.)</p>
                    <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                      {selectedOrder.noteAttributes ? JSON.stringify(selectedOrder.noteAttributes, null, 2) : 'null'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* SMS Communication */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📱 SMS Communication</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-700">Last SMS Sent</h4>
                      <span className="text-xs text-gray-500">lastSmsSent</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">When the last SMS was sent to customer</p>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                      {selectedOrder.lastSmsSent ? new Date(selectedOrder.lastSmsSent).toLocaleString() : 'null'}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-gray-700">SMS History</h4>
                      <span className="text-xs text-gray-500">smsHistory</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Complete SMS communication history</p>
                    <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                      {selectedOrder.smsHistory ? JSON.stringify(selectedOrder.smsHistory, null, 2) : 'null'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">⏰ Timestamps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'createdAt', label: 'Created At', description: 'When order was created' },
                    { key: 'updatedAt', label: 'Updated At', description: 'When order was last updated' },
                    { key: 'processedAt', label: 'Processed At', description: 'When order was processed' },
                    { key: 'cancelledAt', label: 'Cancelled At', description: 'When order was cancelled' },
                    { key: 'closedAt', label: 'Closed At', description: 'When order was closed' },
                    { key: 'syncedAt', label: 'Synced At', description: 'When order was last synced from Shopify' },
                    { key: 'dbCreatedAt', label: 'DB Created At', description: 'When record was created in database' },
                    { key: 'dbUpdatedAt', label: 'DB Updated At', description: 'When record was last updated in database' }
                  ].map(({ key, label, description }) => (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-gray-700">{label}</h4>
                        <span className="text-xs text-gray-500">{key}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{description}</p>
                      <div className="text-sm font-mono bg-gray-50 p-2 rounded">
                        {selectedOrder[key as keyof typeof selectedOrder] ? 
                          new Date(selectedOrder[key as keyof typeof selectedOrder] as string).toLocaleString() : 
                          'null'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Data Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🔍 Raw Data (All Fields)</h3>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">Complete raw order data as stored in database</p>
                  <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(selectedOrder, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">
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