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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DispatchOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function DispatchOrderModal({ isOpen, onClose, order, onUpdate }: DispatchOrderModalProps) {
  const [driverId, setDriverId] = useState(order.driverId || '');
  const [leaveTime, setLeaveTime] = useState(order.leaveTime || '');

  const handleDispatch = async () => {
    await onUpdate({
      driverId,
      leaveTime,
      isDispatched: true,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby="dispatch-order-description">
        <DialogHeader>
          <DialogTitle>Dispatch Order #{order.orderNumber}</DialogTitle>
          <DialogDescription id="dispatch-order-description">
            Assign a driver and set the leave time for this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="driver">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger id="driver">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver1">Driver 1</SelectItem>
                <SelectItem value="driver2">Driver 2</SelectItem>
                <SelectItem value="driver3">Driver 3</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleDispatch}>Dispatch Order</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 