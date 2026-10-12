'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export interface OrderChangeLog {
  id: string;
  action: string;
  changedAt: string;
  changedByUserId: string | null;
  changedByName: string | null;
  changedByEmail: string | null;
  source: string | null;
  changes: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
}

export interface OrderAllData {
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
  deliveryDate?: string;
  deliveryTime?: string;
  leaveTime?: string;
  travelTime?: string;
  internalNote?: string;
  noteAttributes?: any | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  deliveryInstructions?: string | null;
  lastSmsSent?: string | null;
  smsHistory?: any | null;
  deliveryDateResolved?: string | null;
  deliveryDateResolvedSource?: string | null;
  deliveryDateResolvedAt?: string | null;
  driverId?: string | null;
  isDispatched?: boolean;
  orderChangeLogs?: OrderChangeLog[];
}

interface OrderAllDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Order to display. Fresh data is fetched from the API whenever the modal opens. */
  orderId: string | null;
  /** Optional already-loaded order so the modal can render before the fetch lands. */
  seedOrder?: OrderAllData | null;
  /** Fired after a successful save so callers can refresh their own copy of the order. */
  onOrderUpdated?: (order: OrderAllData) => void;
}

const parseMoneyDraft = (value: string): number => {
  const normalized = String(value ?? '').replace(/[^0-9.-]/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLogValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
};

const getLogActor = (log: OrderChangeLog): string => {
  return log.changedByName || log.changedByEmail || log.changedByUserId || 'System';
};

const toPricingDraft = (order: Pick<OrderAllData, 'totalPrice' | 'subtotalPrice' | 'totalTax'>) => ({
  totalPrice: Number(order.totalPrice || 0).toFixed(2),
  subtotalPrice: Number(order.subtotalPrice || 0).toFixed(2),
  totalTax: Number(order.totalTax || 0).toFixed(2),
});

export function OrderAllDataModal({
  open,
  onOpenChange,
  orderId,
  seedOrder = null,
  onOrderUpdated,
}: OrderAllDataModalProps) {
  const [order, setOrder] = useState<OrderAllData | null>(seedOrder);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingDraft, setPricingDraft] = useState({
    totalPrice: '',
    subtotalPrice: '',
    totalTax: '',
  });

  useEffect(() => {
    if (!open || !orderId) return;

    let cancelled = false;
    setOrder(seedOrder && seedOrder.id === orderId ? seedOrder : null);
    setLoadError(null);
    setSaveError(null);
    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load order details');
        }
        const detail = (await response.json()) as OrderAllData;
        if (!cancelled) setOrder(detail);
      } catch (err) {
        console.error('Error loading order details:', err);
        if (!cancelled) {
          setLoadError('Could not load full order history. Showing available order data.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // seedOrder is a render-time convenience only; refetching is keyed on the order itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  useEffect(() => {
    if (!order) return;
    setPricingDraft(toPricingDraft(order));
  }, [order?.id, order?.totalPrice, order?.subtotalPrice, order?.totalTax]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePricing = useCallback(async () => {
    if (!order) return;
    setIsSavingPricing(true);
    setSaveError(null);
    try {
      const updates = {
        totalPrice: parseMoneyDraft(pricingDraft.totalPrice),
        subtotalPrice: parseMoneyDraft(pricingDraft.subtotalPrice),
        totalTax: parseMoneyDraft(pricingDraft.totalTax),
      };
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update pricing');
      }
      const updatedOrder = (await response.json()) as OrderAllData;
      setOrder((prev) => (prev ? { ...prev, ...updatedOrder } : updatedOrder));
      setPricingDraft(toPricingDraft(updatedOrder));
      onOrderUpdated?.(updatedOrder);
    } catch (err) {
      console.error('Error updating pricing:', err);
      setSaveError('Failed to update pricing. Please try again.');
    } finally {
      setIsSavingPricing(false);
    }
  }, [order, pricingDraft, onOrderUpdated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Order #{order?.orderNumber} - Complete Data</DialogTitle>
          <DialogDescription>
            All available data for this order, including all database fields, attributes, and metadata
          </DialogDescription>
        </DialogHeader>

        {!order && isLoading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading order data...</div>
        ) : null}

        {!order && !isLoading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {loadError || 'No order data available.'}
          </div>
        ) : null}

        {order && (
          <div className="mt-4 space-y-6">
            {loadError ? (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {loadError}
              </div>
            ) : null}
            {isLoading ? (
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Loading latest order history...
              </div>
            ) : null}

            {/* Quick Reference Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Quick Reference</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Customer:</span> {order.customerFirstName} {order.customerLastName}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {order.customerPhone || 'Not provided'}
                </div>
                <div>
                  <span className="font-medium">Delivery Date:</span> {order.deliveryDate || 'Not set'}
                </div>
                <div>
                  <span className="font-medium">Delivery Time:</span> {order.deliveryTime || 'Not set'}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {order.fulfillmentStatus || 'Unfulfilled'}
                </div>
                <div>
                  <span className="font-medium">Total:</span> ${Number(order.totalPrice || 0).toFixed(2)}
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
                      {order[key as keyof typeof order]?.toString() || 'null'}
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
                    <input
                      type="number"
                      step="0.01"
                      value={pricingDraft[key as keyof typeof pricingDraft] ?? ''}
                      onChange={(e) =>
                        setPricingDraft((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full text-sm font-mono bg-gray-50 p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              {saveError ? (
                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {saveError}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPricingDraft(toPricingDraft(order))}
                  className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  disabled={isSavingPricing}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSavePricing}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSavingPricing}
                >
                  {isSavingPricing ? 'Saving...' : 'Save Pricing'}
                </button>
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
                      {order[key as keyof typeof order]?.toString() || 'null'}
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
                      {order[key as keyof typeof order]?.toString() || 'null'}
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
                    {order.shippingAddress ? JSON.stringify(order.shippingAddress, null, 2) : 'null'}
                  </pre>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm text-gray-700">Billing Address</h4>
                    <span className="text-xs text-gray-500">billingAddress</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Customer billing address</p>
                  <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                    {order.billingAddress ? JSON.stringify(order.billingAddress, null, 2) : 'null'}
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
                  {order.lineItems ? JSON.stringify(order.lineItems, null, 2) : 'null'}
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
                      {order[key as keyof typeof order]?.toString() || 'null'}
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
                    {order.noteAttributes ? JSON.stringify(order.noteAttributes, null, 2) : 'null'}
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
                    {order.lastSmsSent ? new Date(order.lastSmsSent).toLocaleString() : 'null'}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm text-gray-700">SMS History</h4>
                    <span className="text-xs text-gray-500">smsHistory</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Complete SMS communication history</p>
                  <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-auto max-h-32">
                    {order.smsHistory ? JSON.stringify(order.smsHistory, null, 2) : 'null'}
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
                      {order[key as keyof typeof order] ?
                        new Date(order[key as keyof typeof order] as string).toLocaleString() :
                        'null'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit/Input History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🧾 Edit & Input History</h3>
              {!order.orderChangeLogs || order.orderChangeLogs.length === 0 ? (
                <div className="border rounded-lg p-3 text-sm text-gray-500">
                  No logged order edits yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {order.orderChangeLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-800">{getLogActor(log)}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.changedAt).toLocaleString('en-NZ')}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {log.action}
                        {log.source ? ` · ${log.source}` : ''}
                      </div>
                      <div className="mt-3 space-y-2">
                        {Array.isArray(log.changes) && log.changes.length > 0 ? (
                          log.changes.map((change, index) => (
                            <div key={`${log.id}:${change.field}:${index}`} className="rounded bg-gray-50 p-2 text-xs">
                              <div className="font-semibold text-gray-700">{change.field}</div>
                              <div className="text-gray-600">
                                <span className="font-medium">Before:</span> {formatLogValue(change.before)}
                              </div>
                              <div className="text-gray-600">
                                <span className="font-medium">After:</span> {formatLogValue(change.after)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-500">No field-level changes captured.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw Data Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🔍 Raw Data (All Fields)</h3>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">Complete raw order data as stored in database</p>
                <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(order, null, 2)}
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
  );
}
