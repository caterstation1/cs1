import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function EditOrderModal({ isOpen, onClose, order, onUpdate }: EditOrderModalProps) {
  const [deliveryTime, setDeliveryTime] = useState(order.deliveryTime);
  const [deliveryDate, setDeliveryDate] = useState(new Date(order.deliveryDate).toISOString().split('T')[0]);
  const [travelTime, setTravelTime] = useState(order.travelTime || '');
  const [leaveTime, setLeaveTime] = useState(order.leaveTime || '');
  const [orderNotes, setOrderNotes] = useState(order.orderNotes || '');

  const handleSave = async () => {
    await onUpdate({
      deliveryTime,
      deliveryDate: new Date(deliveryDate),
      travelTime,
      leaveTime,
      orderNotes,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby="edit-order-description">
        <DialogHeader>
          <DialogTitle>Edit Order #{order.orderNumber}</DialogTitle>
          <DialogDescription id="edit-order-description">
            Update the delivery details and notes for this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deliveryTime">Delivery Time</Label>
              <Input
                id="deliveryTime"
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deliveryDate">Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="travelTime">Travel Time (minutes)</Label>
              <Input
                id="travelTime"
                type="number"
                value={travelTime}
                onChange={(e) => setTravelTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="leaveTime">Leave Time</Label>
              <Input
                id="leaveTime"
                type="time"
                value={leaveTime}
                onChange={(e) => setLeaveTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="orderNotes">Order Notes</Label>
            <Textarea
              id="orderNotes"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 