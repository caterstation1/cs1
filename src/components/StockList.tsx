"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface StockItem {
  id: string
  name: string
  quantity: number
  unit: string
  lowStock: boolean
}

interface StockListProps {
  items: StockItem[]
}

export function StockList({ items }: StockListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Stock Items</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock items found</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg border"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.lowStock && (
                    <Badge variant="destructive">Low Stock</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.quantity} {item.unit}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
} 