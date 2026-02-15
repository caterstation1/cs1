'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Check, CheckCheck, Archive, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface MessageCardProps {
  message: any
  onStatusChange: (id: string, status: string) => Promise<void>
  onReply: (message: any) => void
  onOrderHover?: (orderNumber: number, event: React.MouseEvent) => void
  onOrderLeave?: () => void
}

export function MessageCard({ message, onStatusChange, onReply, onOrderHover, onOrderLeave }: MessageCardProps) {
  const [isRepliesExpanded, setIsRepliesExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [stockOrder, setStockOrder] = useState<any | null>(null)
  const hasStockOrder = !!message.stockOrderId

  useEffect(() => {
    let active = true
    async function load() {
      if (!hasStockOrder) return
      try {
        const res = await fetch(`/api/stock-orders/${message.stockOrderId}`)
        if (!active) return
        if (res.ok) setStockOrder(await res.json())
      } catch {}
    }
    load()
    return () => { active = false }
  }, [message.stockOrderId, hasStockOrder])

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      await onStatusChange(message.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  // Render content with highlighted mentions
  const renderContent = (content: string) => {
    const parts: React.ReactElement[] = []
    let lastIndex = 0
    
    // Match @mentions: @12345 (order numbers) or @FirstName LastName (staff)
    const regex = /@(\d+|[\w\s.@]+?)(?=\s|$|@|,|\.|\n|!|\?)/gi
    const matches = Array.from(content.matchAll(regex))
    
    matches.forEach((match, idx) => {
      const beforeText = content.substring(lastIndex, match.index)
      if (beforeText) parts.push(<span key={`text-${idx}`}>{beforeText}</span>)
      
      const mention = match[1]
      const isOrder = /^\d+$/.test(mention) // Check if it's just digits (order number)
      
      if (isOrder) {
        const orderNum = parseInt(mention)
        parts.push(
          <span
            key={`mention-${idx}`}
            className="font-semibold text-purple-600 cursor-help hover:underline"
            onMouseEnter={(e) => onOrderHover?.(orderNum, e)}
            onMouseLeave={() => onOrderLeave?.()}
          >
            @{mention}
          </span>
        )
      } else {
        parts.push(
          <span key={`mention-${idx}`} className="font-semibold text-blue-600">
            @{mention}
          </span>
        )
      }
      
      lastIndex = match.index! + match[0].length
    })
    
    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{content.substring(lastIndex)}</span>)
    }
    
    return <div className="whitespace-pre-wrap">{parts}</div>
  }

  const statusColorMap: Record<string, string> = {
    new: 'bg-blue-50 border-blue-200',
    understood: 'bg-green-50 border-green-200',
    actioned: 'bg-purple-50 border-purple-200',
    archived: 'bg-gray-50 border-gray-200'
  }
  const statusColor = statusColorMap[message.status] || 'bg-white border-gray-200'

  const replies = message.replies || []

  return (
    <div className={`border rounded-lg p-4 ${statusColor} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-sm">{message.createdByName}</div>
          <div className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </div>
        </div>
        <Badge variant={message.status === 'new' ? 'default' : 'secondary'}>
          {message.status}
        </Badge>
      </div>

      {/* Content */}
      <div className="text-sm mb-3">
        {renderContent(message.content)}
      </div>

      {/* Stock Order render */}
      {hasStockOrder && stockOrder && (
        <div className="mb-3 border rounded bg-white">
          <div className="p-2 text-xs text-gray-600">Stock Order #{stockOrder.id} • Status: {stockOrder.status}</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Item</th>
                <th className="text-right p-2">Unit</th>
                <th className="text-center p-2">Qty</th>
                <th className="text-right p-2">Line</th>
              </tr>
            </thead>
            <tbody>
              {stockOrder.items.map((i: any) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.nameSnapshot}</td>
                  <td className="p-2 text-right">${parseFloat(i.unitPriceExGst).toFixed(2)}</td>
                  <td className="p-2 text-center">{i.qty}</td>
                  <td className="p-2 text-right">${parseFloat(i.lineTotalExGst).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="p-2" colSpan={4}>Subtotal (ex GST)</td>
                <td className="p-2 text-right">${parseFloat(stockOrder.subtotalExGst).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2" colSpan={4}>GST 15%</td>
                <td className="p-2 text-right">${parseFloat(stockOrder.gst15).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold" colSpan={4}>Total (inc GST)</td>
                <td className="p-2 text-right font-semibold">${parseFloat(stockOrder.totalIncGst).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Replies - Always expanded */}
      {replies.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-600 font-semibold mb-2">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}:
          </div>
          <div className="space-y-2 pl-4 border-l-2 border-gray-300">
            {replies.map((reply: any) => (
              <div key={reply.id} className="bg-white p-2 rounded text-xs">
                <div className="font-semibold">{reply.createdByName}</div>
                <div className="text-gray-500 text-[10px] mb-1">
                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                </div>
                {renderContent(reply.content)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {message.status === 'new' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('understood')}
              disabled={isUpdating}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Understood
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('actioned')}
              disabled={isUpdating}
              className="h-7 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Have Actioned
            </Button>
          </>
        )}
        {hasStockOrder && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isUpdating} onClick={async()=>{ setIsUpdating(true); try{ const r= await fetch(`/api/stock-orders/${message.stockOrderId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'confirmed' })}); if(r.ok) setStockOrder(await r.json()) } finally { setIsUpdating(false) } }}>Confirmed</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isUpdating} onClick={async()=>{ setIsUpdating(true); try{ const r= await fetch(`/api/stock-orders/${message.stockOrderId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'shipped' })}); if(r.ok) setStockOrder(await r.json()) } finally { setIsUpdating(false) } }}>Shipped</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isUpdating} onClick={async()=>{ setIsUpdating(true); try{ const r= await fetch(`/api/stock-orders/${message.stockOrderId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'received' })}); if(r.ok) setStockOrder(await r.json()) } finally { setIsUpdating(false) } }}>Received</Button>
          </>
        )}
        {(message.status === 'understood' || message.status === 'actioned') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange('archived')}
            disabled={isUpdating}
            className="h-7 text-xs"
          >
            <Archive className="h-3 w-3 mr-1" />
            Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onReply(message)}
          className="h-7 text-xs"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Reply
        </Button>
      </div>
    </div>
  )
}

