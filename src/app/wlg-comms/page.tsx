'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Plus, Archive as ArchiveIcon, RefreshCw } from 'lucide-react'
import { MessageCard } from '@/components/wlg-comms/MessageCard'
import { CreateMessageModal } from '@/components/wlg-comms/CreateMessageModal'
import { ReplyDialog } from '@/components/wlg-comms/ReplyDialog'
import { StockOrderModal } from '@/components/wlg-comms/StockOrderModal'

export default function WLGCommsPage() {
  const { data: session, status } = useSession()
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isReplyOpen, setIsReplyOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [orderPreview, setOrderPreview] = useState<any | null>(null)
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 })
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

  // Extract user from nested session structure
  const currentUser = (session as any)?.session?.user || session?.user as any
  
  console.log('🔍 WLG Comms - Session status:', status)
  console.log('🔍 WLG Comms - Session data:', session)
  console.log('🔍 WLG Comms - Current user:', currentUser)

  const fetchMessages = useCallback(async () => {
    console.log('🔍 fetchMessages called')
    try {
      setIsLoading(true)
      console.log('🔍 Fetching from /api/wlg-messages...')
      const res = await fetch('/api/wlg-messages')
      console.log('🔍 Response:', res.status, res.statusText)
      if (res.ok) {
        const data = await res.json()
        console.log('🔍 Messages data:', data)
        setMessages(data)
      } else {
        console.error('❌ Failed to fetch messages:', res.status, res.statusText)
        const errorText = await res.text()
        console.error('❌ Error response:', errorText)
      }
    } catch (error) {
      console.error('❌ Error fetching messages:', error)
    } finally {
      console.log('🔍 Setting isLoading to false')
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    console.log('🔍 useEffect running - status:', status, 'session?.user:', session?.user, 'session:', session)
    if (status === 'authenticated' && session) {
      console.log('🔍 Status is authenticated, calling fetchMessages')
      fetchMessages()
    } else if (status === 'unauthenticated') {
      console.log('🔍 Status is unauthenticated, setting isLoading false')
      setIsLoading(false)
    } else {
      console.log('🔍 Status is loading, waiting...')
    }
  }, [fetchMessages, status, session])

  const handleCreateMessage = async (content: string) => {
    if (!currentUser) return
    
    try {
      const createdByName = currentUser.firstName && currentUser.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser.name || 'Unknown'
      
      console.log('📝 Creating message:', { content, createdBy: currentUser.id, createdByName })
      
      const res = await fetch('/api/wlg-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          createdBy: currentUser.id,
          createdByName
        })
      })
      
      console.log('📝 Create response:', res.status, res.statusText)
      
      if (res.ok) {
        const result = await res.json()
        console.log('📝 Created message:', result)
        await fetchMessages()
      } else {
        const errorText = await res.text()
        console.error('❌ Failed to create message:', errorText)
      }
    } catch (error) {
      console.error('❌ Error creating message:', error)
    }
  }

  const handleReply = async (content: string, parentId: string) => {
    if (!currentUser) return
    
    try {
      const createdByName = currentUser.firstName && currentUser.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : currentUser.name || 'Unknown'
      
      const res = await fetch('/api/wlg-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          createdBy: currentUser.id,
          createdByName,
          parentId
        })
      })
      
      if (res.ok) {
        await fetchMessages()
      }
    } catch (error) {
      console.error('Error replying to message:', error)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/wlg-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (res.ok) {
        await fetchMessages()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleOrderHover = useCallback(async (orderNumber: number, event: React.MouseEvent) => {
    try {
      console.log('🔍 Fetching order preview for:', orderNumber)
      const res = await fetch(`/api/order/${orderNumber}`)
      console.log('🔍 Order fetch response:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('🔍 Order data:', data)
        // Extract the database fields from the response
        const order = data.database || data
        setOrderPreview(order)
        const rect = (event.target as HTMLElement).getBoundingClientRect()
        setPreviewPosition({
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX
        })
      } else {
        console.error('❌ Failed to fetch order:', res.status)
      }
    } catch (error) {
      console.error('❌ Error fetching order:', error)
    }
  }, [])

  const handleOrderLeave = useCallback(() => {
    setOrderPreview(null)
  }, [])

  const newMessages = messages.filter(m => m.status === 'new' && !m.parentId)
  const actionedMessages = messages.filter(m => (m.status === 'understood' || m.status === 'actioned') && !m.parentId)
  const archivedMessages = messages.filter(m => m.status === 'archived' && !m.parentId)

  if (status === 'loading' || !currentUser) {
    return <div className="p-8 text-center">
      {status === 'loading' ? 'Loading session...' : 'Initializing...'}
    </div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">WLG Communications</h1>
        <div className="flex gap-2">
          <Button onClick={fetchMessages} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowArchived(!showArchived)} variant="outline" size="sm">
            <ArchiveIcon className="h-4 w-4 mr-2" />
            {showArchived ? 'Hide' : 'View'} Archived
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
          <Button onClick={() => setIsOrderModalOpen(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading messages...</div>
      ) : showArchived ? (
        /* Archive View */
        <div>
          <h2 className="text-xl font-semibold mb-4">Archived Messages ({archivedMessages.length})</h2>
          <div className="space-y-3">
            {archivedMessages.map(message => (
              <MessageCard
                key={message.id}
                message={message}
                onStatusChange={handleStatusChange}
                onReply={(msg) => { setReplyingTo(msg); setIsReplyOpen(true); }}
                onOrderHover={handleOrderHover}
                onOrderLeave={handleOrderLeave}
              />
            ))}
            {archivedMessages.length === 0 && (
              <div className="text-center py-12 text-gray-500">No archived messages</div>
            )}
          </div>
        </div>
      ) : (
        /* Main View: New | Actioned/Understood */
        <div className="grid grid-cols-2 gap-6">
          {/* Left: New Messages */}
          <div>
            <h2 className="text-xl font-semibold mb-4">New Messages ({newMessages.length})</h2>
            <div className="space-y-3">
              {newMessages.map(message => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onStatusChange={handleStatusChange}
                  onReply={(msg) => { setReplyingTo(msg); setIsReplyOpen(true); }}
                  onOrderHover={handleOrderHover}
                  onOrderLeave={handleOrderLeave}
                />
              ))}
              {newMessages.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg">
                  No new messages
                </div>
              )}
            </div>
          </div>

          {/* Right: Understood/Actioned Messages */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Understood / Actioned ({actionedMessages.length})</h2>
            <div className="space-y-3">
              {actionedMessages.map(message => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onStatusChange={handleStatusChange}
                  onReply={(msg) => { setReplyingTo(msg); setIsReplyOpen(true); }}
                  onOrderHover={handleOrderHover}
                  onOrderLeave={handleOrderLeave}
                />
              ))}
              {actionedMessages.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed rounded-lg">
                  No actioned messages
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Preview Popup */}
      {orderPreview && (
        <div
          className="fixed z-50 bg-white border-2 border-purple-400 rounded-lg shadow-xl p-4 max-w-md"
          style={{ top: `${previewPosition.top}px`, left: `${previewPosition.left}px` }}
          onMouseEnter={() => setOrderPreview(orderPreview)}
          onMouseLeave={handleOrderLeave}
        >
          <div className="space-y-2 text-sm">
            <div className="font-bold text-purple-700">Order #{orderPreview.orderNumber}</div>
            <div><strong>Customer:</strong> {orderPreview.customerFirstName} {orderPreview.customerLastName}</div>
            {orderPreview.customerCompany && <div><strong>Company:</strong> {orderPreview.customerCompany}</div>}
            {orderPreview.deliveryDate && <div><strong>Date:</strong> {new Date(orderPreview.deliveryDate).toLocaleDateString('en-NZ')}</div>}
            {orderPreview.deliveryTime && <div><strong>Time:</strong> {orderPreview.deliveryTime}</div>}
            <div className="text-xs"><strong>Address:</strong> {orderPreview.shippingAddress?.address1 || orderPreview.shippingAddress || 'N/A'}</div>
            {Array.isArray(orderPreview.lineItems) && orderPreview.lineItems.length > 0 && (
              <div>
                <strong>Products:</strong>
                <ul className="ml-4 mt-1 text-xs">
                  {orderPreview.lineItems.slice(0, 3).map((item: any, idx: number) => (
                    <li key={idx}>{item.quantity || 1}x {item.title || item.name || 'Unknown'}</li>
                  ))}
                  {orderPreview.lineItems.length > 3 && <li>+{orderPreview.lineItems.length - 3} more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Message Modal */}
      <CreateMessageModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateMessage}
        currentUser={currentUser}
      />

      {/* New Order Modal */}
      <StockOrderModal isOpen={isOrderModalOpen} onClose={() => { setIsOrderModalOpen(false); fetchMessages() }} currentUser={currentUser} />

      {/* Reply Dialog */}
      <ReplyDialog
        isOpen={isReplyOpen}
        onClose={() => { setIsReplyOpen(false); setReplyingTo(null); }}
        parentMessage={replyingTo}
        onSubmit={handleReply}
      />
    </div>
  )
}

