'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Send } from 'lucide-react'

interface CreateMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string) => Promise<void>
  currentUser: { id: string; firstName: string; lastName: string }
}

export function CreateMessageModal({ isOpen, onClose, onSubmit, currentUser }: CreateMessageModalProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [staff, setStaff] = useState<any[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteOptions, setAutocompleteOptions] = useState<any[]>([])
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load staff list
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const data = await res.json()
          setStaff(Array.isArray(data) ? data : (data.staff || []))
        }
      } catch (error) {
        console.error('Error loading staff:', error)
      }
    }
    if (isOpen) loadStaff()
  }, [isOpen])

  // Handle @ autocomplete
  const handleContentChange = (value: string) => {
    setContent(value)
    
    // Check if user is typing @ mention
    const textarea = textareaRef.current
    if (!textarea) return
    
    const cursorPos = textarea.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // Check if there's a space or newline after @ (if so, close autocomplete)
      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        setShowAutocomplete(false)
        return
      }
      
      const query = textAfterAt.toLowerCase()
      const matches = staff.filter(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
      ).slice(0, 5)
      
      if (matches.length > 0) {
        setAutocompleteOptions(matches)
        setSelectedIndex(0)
        setShowAutocomplete(true)
      } else {
        setShowAutocomplete(false)
      }
    } else {
      setShowAutocomplete(false)
    }
  }

  const insertMention = (person: any) => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    const cursorPos = textarea.selectionStart
    const textBeforeCursor = content.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex >= 0) {
      const before = content.substring(0, lastAtIndex)
      const after = content.substring(cursorPos)
      const mention = `@${person.firstName} ${person.lastName}`
      setContent(before + mention + ' ' + after)
      setShowAutocomplete(false)
      
      // Focus back and position cursor
      setTimeout(() => {
        textarea.focus()
        const newPos = (before + mention + ' ').length
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim()) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(content)
      setContent('')
      onClose()
    } catch (error) {
      console.error('Error submitting message:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete && autocompleteOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % autocompleteOptions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + autocompleteOptions.length) % autocompleteOptions.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(autocompleteOptions[selectedIndex])
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Use @ to mention staff (e.g., @John Doe) or reference orders (e.g., @ORDER-12345)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Label>Message</Label>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... Use @ to mention someone or @ORDER-12345 to reference an order."
              rows={6}
              className="resize-none"
            />
            
            {/* Autocomplete Dropdown */}
            {showAutocomplete && autocompleteOptions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-full bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
                {autocompleteOptions.map((person, idx) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => insertMention(person)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${idx === selectedIndex ? 'bg-blue-50' : ''}`}
                  >
                    <div className="font-medium text-sm">{person.firstName} {person.lastName}</div>
                    <div className="text-xs text-gray-500">{person.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

