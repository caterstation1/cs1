import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditOrderModal } from './edit-order-modal';
import { DispatchOrderModal } from './dispatch-order-modal';

interface Order {
  id: string;
  shopifyId: string;
  orderNumber: number;
  createdAt: string;
  totalPrice: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus?: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  tags?: string;
  note?: string;
  lineItems: any[];
  hasLocalEdits: boolean;
  isDispatched: boolean;
  driverId?: string;
  travelTime?: string;
  leaveTime?: string;
}

interface OrderCardProps {
  order: Order;
  onUpdate: (orderId: string, updates: any) => Promise<void>;
}

export function OrderCard({ order, onUpdate }: OrderCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [parsedOrder, setParsedOrder] = useState<any>(null);

  useEffect(() => {
    const parseOrder = async () => {
      try {
        const response = await fetch('/api/orders/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, action: 'parse' })
        });
        const data = await response.json();
        setParsedOrder(data);
      } catch (error) {
        console.error('Error parsing order:', error);
      }
    };

    parseOrder();
  }, [order]);

  const handleUpdate = async (updates: any) => {
    try {
      const response = await fetch('/api/orders/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          order: { orderId: parsedOrder.id, updates },
          action: 'update'
        })
      });
      const updatedOrder = await response.json();
      setParsedOrder(updatedOrder);
      await onUpdate(order.id, { hasLocalEdits: true });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  if (!parsedOrder) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order #{parsedOrder.orderNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Delivery Details</h3>
            <p>Time: {parsedOrder.deliveryTime || 'N/A'}</p>
            <p>Date: {parsedOrder.deliveryDate && !isNaN(Date.parse(parsedOrder.deliveryDate)) ? new Date(parsedOrder.deliveryDate).toLocaleDateString() : 'N/A'}</p>
            <p>Address: {JSON.stringify(parsedOrder.deliveryAddress)}</p>
          </div>
          
          <div>
            <h3 className="font-medium">Customer Details</h3>
            <p>Name: {parsedOrder.customerName}</p>
            <p>Company: {parsedOrder.customerCompany || 'N/A'}</p>
            <p>Phone: {parsedOrder.customerPhone}</p>
          </div>

          <div>
            <h3 className="font-medium">Order Items</h3>
            <ul className="list-disc pl-5">
              {parsedOrder.lineItems.map((item: any) => (
                <li key={item.id}>
                  {item.quantity}x {item.title} ({item.sku})
                </li>
              ))}
            </ul>
          </div>

          <div className="flex space-x-2">
            <Button onClick={() => setIsEditModalOpen(true)}>Edit</Button>
            <Button onClick={() => setIsDispatchModalOpen(true)}>Dispatch</Button>
          </div>
        </div>

        <EditOrderModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          order={parsedOrder}
          onUpdate={handleUpdate}
        />

        <DispatchOrderModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          order={parsedOrder}
          onUpdate={handleUpdate}
        />
      </CardContent>
    </Card>
  );
} 