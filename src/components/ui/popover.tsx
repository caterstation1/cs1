import * as React from 'react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}

interface PopoverTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  onOpenAutoFocus?: (e: any) => void
  onCloseAutoFocus?: (e: any) => void
}

const PopoverContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {}
})

export function Popover({ children, open, onOpenChange, modal }: PopoverProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false)
  
  // Use controlled state if open/onOpenChange provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalIsOpen
  const setIsOpen = onOpenChange || setInternalIsOpen

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { isOpen, setIsOpen } = React.useContext(PopoverContext)
    
    const handleClick = () => setIsOpen(!isOpen)
    
    if (asChild) {
      return (
        <div onClick={handleClick} ref={ref as any}>
          {children}
        </div>
      )
    }
    
    return (
      <button
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    )
  }
)
PopoverTrigger.displayName = 'PopoverTrigger'

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, children, align = 'center', sideOffset = 4, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
    const { isOpen, setIsOpen } = React.useContext(PopoverContext)
    
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (ref && 'current' in ref && ref.current && !ref.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, setIsOpen, ref])
    
    if (!isOpen) return null
    
    return (
      <div
        ref={ref}
        className={cn(
          'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95',
          className
        )}
        style={{ 
          position: 'absolute',
          top: '100%',
          left: align === 'start' ? 0 : align === 'end' ? 'auto' : '50%',
          right: align === 'end' ? 0 : 'auto',
          transform: align === 'center' ? 'translateX(-50%)' : 'none',
          marginTop: `${sideOffset}px`
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PopoverContent.displayName = 'PopoverContent'
