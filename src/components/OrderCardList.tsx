"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  deliveryDate: string
  deliveryTime: string
  status: string
  items: OrderItem[]
  totalPrice: number
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  modifications?: string[]
}

interface OrderCardListProps {
  orders: Order[]
}

export function OrderCardList({ orders }: OrderCardListProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "default"
      case "processing":
        return "secondary"
      case "completed":
        return "outline"
      case "cancelled":
        return "destructive"
      default:
        return "default"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.length === 0 ? (
        <div className="col-span-full text-center p-8 border rounded-lg">
          <p className="text-muted-foreground">No orders found</p>
        </div>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="p-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">Order #{order.orderNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.customerName}
                  </p>
                </div>
                <Badge variant={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Delivery Date:</span>
                <span className="font-medium">{formatDate(order.deliveryDate)}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span>Delivery Time:</span>
                <span className="font-medium">{order.deliveryTime}</span>
              </div>
              <div className="text-sm mb-2">
                <span className="font-medium">Items:</span>
              </div>
              <ScrollArea className="h-24 mb-4">
                <ul className="space-y-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      {item.quantity}x {item.name}
                      {item.modifications && item.modifications.length > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({item.modifications.join(", ")})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <div className="flex justify-between items-center">
                <div className="font-semibold">
                  ${order.totalPrice.toFixed(2)}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Order #{order.orderNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Customer</h4>
                        <p>{order.customerName}</p>
                      </div>
                      <div>
                        <h4 className="font-medium">Delivery</h4>
                        <p>
                          {formatDate(order.deliveryDate)} at {order.deliveryTime}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Items</h4>
                        <ul className="space-y-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between">
                              <span>
                                {item.quantity}x {item.name}
                                {item.modifications && item.modifications.length > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    ({item.modifications.join(", ")})
                                  </span>
                                )}
                              </span>
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Total</span>
                        <span>${order.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
} 