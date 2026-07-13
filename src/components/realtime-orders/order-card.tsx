'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Order } from '@/types/order'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Staff } from '@/types/staff'
import DeliveryMapModal from './delivery-map-modal'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Car, MessageSquare, Settings, Phone, StickyNote } from 'lucide-react'
import { TextOrdersModal } from '@/components/TextOrdersModal'
import { PaymentAlertBadge } from './payment-alert-badge'
import { resolveBundleItems } from '@/lib/product-service'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ProductEditModal, Product as ProductEditType } from '@/components/ProductEditModal';
import { SetRuleModal } from '@/components/SetRuleModal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';

interface Product {
  id: string
  variantId: string
  productId?: string  // New field from ProductVariant
  createdAt: string
  updatedAt: string
  
  // Shopify data (read-only, synced from Shopify)
  shopifyProductId: string
  shopifySku?: string
  shopifyName: string
  shopifyTitle: string
  shopifyPrice: string
  shopifyInventory: number
  shopifyVendor?: string
  shopifyMarket?: string
  heroImageUrl?: string
  
  // Custom operational data (editable)
  displayName?: string
  meat1?: string
  meat2?: string
  timer1?: number | null
  timer2?: number | null
  option1?: string
  option2?: string
  serveware: boolean
  isDraft: boolean
  
  // Component/costing data
  ingredients?: any
  totalCost?: number
  
  // Legacy fields for backward compatibility
  name?: string
  description?: string
  variantSku?: string
  timerA?: number | null
  timerB?: number | null
}

interface OrderCardProps {
  order: Order
  onUpdate: (orderId: string, updates: Partial<Order>) => Promise<Order>
  products: Record<string, Product>
  refreshProducts?: () => Promise<void>
  onBulkUpdateComplete?: () => Promise<void>
  updateProductInState?: (variantId: string, updatedProduct: any) => void
  isAudioEnabled?: boolean
  originAddressOverride?: string
  isTvMode?: boolean
}

export default function OrderCard({ order, onUpdate, products, refreshProducts, onBulkUpdateComplete, updateProductInState, isAudioEnabled = true, originAddressOverride, isTvMode = false }: OrderCardProps) {
  // Debug logging disabled in production for performance and clarity
  const [isExpanded, setIsExpanded] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState(order.deliveryTime || '')
  const [leaveTime, setLeaveTime] = useState(order.leaveTime || '')
  const [travelTime, setTravelTime] = useState<number>(parseInt(order.travelTime || '0'))
  const [driverId, setDriverId] = useState<string>('')
  const [drivers, setDrivers] = useState<Staff[]>([])
  const [carId, setCarId] = useState<string>('')
  const [cars, setCars] = useState<Array<{ id: string; name: string; rego?: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [hasManualTravelTime, setHasManualTravelTime] = useState(false)
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isInternalNoteModalOpen, setIsInternalNoteModalOpen] = useState(false)
  const [isClientTextOpen, setIsClientTextOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isDDModalOpen, setIsDDModalOpen] = useState(false)
  const [ddKm, setDdKm] = useState<number>(0)
  const [ddRate, setDdRate] = useState<number>(2)
  const [ddBase, setDdBase] = useState<number>(10)
  const [ddPayout, setDdPayout] = useState<number>(0)
  const [ddDispatchTime, setDdDispatchTime] = useState<string>(leaveTime || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [editedLineItems, setEditedLineItems] = useState<any[]>([])
  const [note, setNote] = useState(order.note || '')
  const [internalNote, setInternalNote] = useState(order.internalNote || '')
  const [address, setAddress] = useState(order.shippingAddress?.address1 || '')
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate || '')
  
  // Determine if this component is rendered under the WLG Calendar path
  const isWlgCalendar = typeof window !== 'undefined' && window.location.pathname.startsWith('/wlg-calendar')
  
  // SMS functionality
  const [isSendingSms, setIsSendingSms] = useState(false)
  const [smsStatus, setSmsStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [smsMessage, setSmsMessage] = useState('')
  
  // Product editing modal state
  const [productEditModal, setProductEditModal] = useState({
    isOpen: false,
    sku: '',
    productTitle: '',
    productId: '',
    variantTitle: ''
  });
  
  // Use a ref to track if this is the first render
  const isFirstRender = useRef(true)
  
  // Format the order date
  const orderDate = formatDate(order.createdAt)
  
  // Calculate the time since order creation
  const timeSinceOrder = getTimeSinceOrder(order.createdAt)
  
  // Get status badge color
  const statusColor = getStatusColor(order.fulfillmentStatus)
  
  // Parse line items
  let lineItems: any[] = [];
  if (Array.isArray(order.lineItems)) {
    lineItems = order.lineItems;
  } else if (typeof order.lineItems === 'string' && order.lineItems) {
    try {
      lineItems = JSON.parse(order.lineItems);
    } catch (err) {
      console.error('Failed to parse lineItems JSON:', err, order.lineItems);
      lineItems = [];
    }
  }
  // Expand party packs into child display (UI only; DB stays unchanged until saved via Edit Order)
  const expandedDisplayLineItems: any[] = useMemo(() => {
    const out: any[] = []
    for (const it of lineItems) {
      const variantId = it.variant_id?.toString() || it.variantId?.toString();
      const product = variantId ? (products as any)[variantId] : null;
      const qty = Number(it.quantity || 0)
      const children = product ? resolveBundleItems(product) : []
      if (product && children.length > 0) {
        // header row for the pack
        out.push({ ...it, _isPack: true })
        for (const child of children) {
          const childProduct = (products as any)[child.variantId]
          out.push({
            ...it,
            _isPackChild: true,
            variant_id: child.variantId,
            variantId: child.variantId,
            // ensure SKU/title reflect the child for proper addon detection and display
            sku: childProduct?.shopifySku || it.sku,
            title: (childProduct?.shopifyName && childProduct.shopifyName !== 'Default Title') ? childProduct.shopifyName : (childProduct?.shopifyTitle || it.title),
            quantity: qty * Math.max(1, parseInt(String(child.quantity || '1'), 10)),
          })
        }
      } else {
        out.push(it)
      }
    }
    return out
  }, [lineItems, products])
  
  // Get status badge color
  const statusBadgeColor = getStatusColor(order.fulfillmentStatus)
  
  // Extract delivery time from tags
  const extractDeliveryTime = (tags: string | null): string => {
    if (!tags) return '';
    
    // Example tag format: "11:15 AM - 11:30 AM, Thu Apr 17 2025"
    const timeMatch = tags.match(/(\d{1,2}:\d{2}\s*[AP]M)/);
    if (timeMatch) {
      // Convert 12-hour format to 24-hour format
      const timeStr = timeMatch[1];
      const [time, period] = timeStr.split(/(?=[AP]M)/);
      const [hours, minutes] = time.split(':').map(Number);
      
      let adjustedHours = hours;
      if (period === 'PM' && hours < 12) {
        adjustedHours += 12;
      } else if (period === 'AM' && hours === 12) {
        adjustedHours = 0;
      }
      
      return `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    return '';
  };

  // Helper function to convert 24-hour time to 12-hour format for display
  const formatTimeForDisplay = (time: string): string => {
    if (!time) return '';
    
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return '';
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  // Utility to extract and convert the first time in a range to HH:mm
  function extractFirstTimeTo24Hour(timeRange: string): string {
    if (!timeRange) return '';
    // Take the first part before '-' or '–'
    const firstPart = timeRange.split(/[–-]/)[0].trim();
    // Match 12-hour time
    const match = firstPart.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    // If already in 24-hour format
    if (/^\d{2}:\d{2}$/.test(firstPart)) return firstPart;
    return '';
  }

  // Initialize deliveryTime from explicit field first; fallback to tags
  useEffect(() => {
    if (order.deliveryTime) {
      setDeliveryTime(sanitizeTimeInput(order.deliveryTime as any));
      return;
    }
    if (order.tags) {
      const extractedTime = extractDeliveryTime(order.tags);
      if (extractedTime) {
        setDeliveryTime(extractFirstTimeTo24Hour(extractedTime));
      }
    }
  }, [order.deliveryTime, order.tags]);

  // Update the input fields to handle time format conversion
  const handleTimeChange = (time: string, field: 'deliveryTime' | 'leaveTime') => {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return;
      
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      if (field === 'deliveryTime') {
        setDeliveryTime(formattedTime);
        handleUpdate({ deliveryTime: formattedTime });
      } else {
        setLeaveTime(formattedTime);
        handleUpdate({ leaveTime: formattedTime });
      }
    } catch (error) {
      console.error('Error handling time change:', error);
    }
  };
  
  // Extract delivery time from tags
  const extractedDeliveryTime = extractDeliveryTime(order.tags);
  
  // Extract delivery address
  const deliveryAddress = extractDeliveryAddress(order.shippingAddress);
  
  // Use customerPhone directly from the order (populated by sync process)
  const deliveryPhone = order.customerPhone || 'No phone'
  
  // Extract customer details
  const customerName = `${order.customerFirstName} ${order.customerLastName}`
  const customerPhone = order.customerPhone || 'No phone'
  
  // Extract company name from shipping address
  const companyName = extractCompanyName(order.shippingAddress)
  
  // Initialize state from order data
  useEffect(() => {
    if (order.travelTime) {
      setTravelTime(parseInt(order.travelTime))
    }
    if (order.leaveTime) {
      setLeaveTime(order.leaveTime)
    }
    if (order.driverId) {
      setDriverId(order.driverId)
    }
    if ((order as any)?.carId) {
      setCarId((order as any).carId as string)
    }
  }, [order.travelTime, order.leaveTime, order.driverId])
  
  // Update leave time when delivery inputs change; prefer explicit/edited time over tags
  useEffect(() => {
    // Determine an effective delivery time in HH:mm from tags → state → order field
    const fromTags = extractDeliveryTime(order.tags);
    const eff = deliveryTime
      ? sanitizeTimeInput(deliveryTime)
      : (order.deliveryTime
          ? sanitizeTimeInput(order.deliveryTime as any)
          : (fromTags ? extractFirstTimeTo24Hour(fromTags) : ''));

    // Compute desired leave time locally
    let computedLeave = '';
    if (eff && travelTime > 0) {
      const [hours, minutes] = eff.split(':').map(Number);
      const deliveryDate = new Date();
      deliveryDate.setHours(hours, minutes, 0, 0);
      const leaveDate = new Date(deliveryDate.getTime() - (travelTime * 60 * 1000));
      const leaveHours = leaveDate.getHours().toString().padStart(2, '0');
      const leaveMinutes = leaveDate.getMinutes().toString().padStart(2, '0');
      computedLeave = `${leaveHours}:${leaveMinutes}`;
    } else if (eff) {
      computedLeave = eff;
    } else {
      computedLeave = '';
    }

    // Update local state
    if (computedLeave !== leaveTime) {
      setLeaveTime(computedLeave);
      // Persist only when not editing to avoid race conditions from the modal
      if (!isEditModalOpen) {
        handleUpdate({ leaveTime: computedLeave });
      }
    }
  }, [order.tags, order.deliveryTime, deliveryTime, travelTime, isEditModalOpen]);
  
  // Fetch staff for driver dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      if (drivers.length === 0) { // Only fetch if we don't have drivers yet
        setIsLoadingDrivers(true)
        try {
          const response = await fetch('/api/staff')
          if (!response.ok) throw new Error('Failed to fetch staff')
          const data = await response.json()
          const allDrivers = data.filter((staff: Staff) => staff.isDriver)
          const filtered = isWlgCalendar
            ? allDrivers.filter((s: Staff) => s.accessLevel === 'wlg_team' || s.accessLevel === 'wlg_admin')
            : allDrivers
          setDrivers(filtered)
        } catch (error) {
          console.error('Error fetching staff:', error)
        } finally {
          setIsLoadingDrivers(false)
        }
      }
    }
    
    fetchStaff()
  }, [drivers.length]) // Only depend on drivers.length
  
  // Fetch cars for car dropdown
  useEffect(() => {
    const fetchCars = async () => {
      try {
        const res = await fetch('/api/cars', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setCars(list.map((c: any) => ({ id: c.id, name: c.name, rego: c.rego })))
      } catch (e) {
        console.error('Error fetching cars:', e)
      }
    }
    fetchCars()
  }, [])
  
  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isFirstRender.current) {
      const key = `order-${order.id}`
      localStorage.setItem(key, JSON.stringify({
        leaveTime,
        travelTime,
        driverId,
        carId,
        hasManualTravelTime
      }))
    }
  }, [order.id, leaveTime, travelTime, driverId, carId, hasManualTravelTime])
  
  // Load state from localStorage on first render
  useEffect(() => {
    if (isFirstRender.current) {
      const key = `order-${order.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const { leaveTime: savedLeaveTime, travelTime: savedTravelTime, driverId: savedDriverId, carId: savedCarId, hasManualTravelTime: savedManual } = JSON.parse(saved)
          
          // Set the values from localStorage
          if (savedLeaveTime) setLeaveTime(savedLeaveTime)
          if (savedTravelTime) {
            setTravelTime(savedTravelTime)
            // Also update the database with the saved travel time
            handleUpdate({ travelTime: savedTravelTime.toString() })
          }
          if (savedDriverId) setDriverId(savedDriverId)
          if (savedCarId) setCarId(savedCarId)
          if (typeof savedManual === 'boolean') setHasManualTravelTime(savedManual)
        } catch (error) {
          console.error('Error parsing saved state:', error)
        }
      }
      
      isFirstRender.current = false
    }
  }, [order.id])

  // Update the useEffect to initialize editedLineItems
  useEffect(() => {
    let parsedLineItems: any[] = [];
    if (Array.isArray(order.lineItems)) {
      parsedLineItems = order.lineItems;
    } else if (typeof order.lineItems === 'string' && order.lineItems) {
      try {
        parsedLineItems = JSON.parse(order.lineItems);
      } catch (err) {
        console.error('Failed to parse lineItems JSON:', err, order.lineItems);
        parsedLineItems = [];
      }
    }
    setEditedLineItems(parsedLineItems);
  }, [order.lineItems]);

  // Update local state when order changes
  useEffect(() => {
    // Only update local state if the order hasn't been locally edited
    if (!order.hasLocalEdits) {
      setDeliveryTime(order.deliveryTime || '');
      setLeaveTime(order.leaveTime || '');
      setTravelTime(parseInt(order.travelTime || '0'));
      setNote(order.note || '');
      setAddress(order.shippingAddress?.address1 || '');
      setDeliveryDate(order.deliveryDate || '');
      
      let parsedLineItems: any[] = [];
      if (Array.isArray(order.lineItems)) {
        parsedLineItems = order.lineItems;
      } else if (typeof order.lineItems === 'string' && order.lineItems) {
        try {
          parsedLineItems = JSON.parse(order.lineItems);
        } catch (err) {
          console.error('Failed to parse lineItems JSON:', err, order.lineItems);
          parsedLineItems = [];
        }
      }
      setEditedLineItems(parsedLineItems);
    }
  }, [order]);

  // Add a debounce function to prevent too many rapid updates
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Debounced version of the update function
  const debouncedHandleUpdate = useMemo(
    () => debounce(async (updates: Partial<Order>) => {
      setIsLoading(true);
      try {
        await onUpdate(order.id, updates);
      } catch (error) {
        console.error('Error updating order:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [order.id, onUpdate]
  );

  // Utility to sanitize time input to HH:mm format
  function sanitizeTimeInput(value: string): string {
    if (!value) return '';
    // If it's a range, take the first part
    let timePart = value.split(/[–-]/)[0].trim();
    // If it's already HH:mm, return as is
    if (/^\d{2}:\d{2}$/.test(timePart)) return timePart;
    // If it's 12-hour format, convert
    const match = timePart.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return '';
  }

  const handleUpdate = async (updates: Partial<Order>) => {
    // Sanitize time fields before sending
    if (updates.deliveryTime) {
      updates.deliveryTime = sanitizeTimeInput(updates.deliveryTime as string);
    }
    if (updates.leaveTime) {
      updates.leaveTime = sanitizeTimeInput(updates.leaveTime as string);
    }
    console.log('OrderCard handleUpdate called:', updates); // Debug log
    try {
      setIsLoading(true);
      // Add hasLocalEdits flag to prevent sync from overwriting
      const updatesWithFlag = {
        ...updates,
        hasLocalEdits: true
      };
      
      const updatedOrder = await onUpdate(order.id, updatesWithFlag);
      
      // Update local state after successful update
      if (updates.lineItems) {
        setEditedLineItems(updates.lineItems);
      }
      if (updates.deliveryTime) {
        setDeliveryTime(updates.deliveryTime as string);
      }
      if (updates.leaveTime) {
        setLeaveTime(updates.leaveTime as string);
      }
      if (updates.travelTime) {
        setTravelTime(parseInt(updates.travelTime as string));
      }
      if (updates.note) {
        setNote(updates.note as string);
      }
      if (updates.shippingAddress?.address1) {
        setAddress(updates.shippingAddress.address1);
      }
      
      console.log('Order updated successfully:', updatedOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      throw error; // Re-throw to let the calling function handle it
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate timer times
  const calculateTimerTimes = (leaveTime: string, timer1?: number | null, timer2?: number | null): (string | null)[] => {
    if (!leaveTime) return [null, null];
    
    // Skip calculation if both timers are null/undefined
    if (timer1 === null && timer2 === null) return [null, null];
    if (timer1 === undefined && timer2 === undefined) return [null, null];
    
    const [hours, minutes] = leaveTime.split(':').map(Number);
    const leaveTimeInMinutes = hours * 60 + minutes;
    
    const timerTimes: (string | null)[] = [null, null];
    
    if (typeof timer1 === 'number' && !Number.isNaN(timer1)) {
      const timer1TimeInMinutes = leaveTimeInMinutes - timer1;
      const timer1Hours = Math.floor(timer1TimeInMinutes / 60);
      const timer1Minutes = timer1TimeInMinutes % 60;
      const timer1Time = `${timer1Hours.toString().padStart(2, '0')}:${timer1Minutes.toString().padStart(2, '0')}`;
      timerTimes[0] = timer1Time;
    }
    
    if (typeof timer2 === 'number' && !Number.isNaN(timer2)) {
      const timer2TimeInMinutes = leaveTimeInMinutes - timer2;
      const timer2Hours = Math.floor(timer2TimeInMinutes / 60);
      const timer2Minutes = timer2TimeInMinutes % 60;
      const timer2Time = `${timer2Hours.toString().padStart(2, '0')}:${timer2Minutes.toString().padStart(2, '0')}`;
      timerTimes[1] = timer2Time;
    }
    
    return timerTimes;
  };

  // Handle travel time input change
  const handleTravelTimeChange = (value: number) => {
    if (value !== travelTime) {
      setTravelTime(value);
      setHasManualTravelTime(true);
      // Always use the latest local deliveryTime for recalculation
      let leave = deliveryTime;
      if (deliveryTime && value > 0) {
        const [hours, minutes] = deliveryTime.split(':').map(Number);
        const deliveryDate = new Date();
        deliveryDate.setHours(hours, minutes, 0, 0);
        const leaveDate = new Date(deliveryDate.getTime() - (value * 60 * 1000));
        const leaveHours = leaveDate.getHours().toString().padStart(2, '0');
        const leaveMinutes = leaveDate.getMinutes().toString().padStart(2, '0');
        leave = `${leaveHours}:${leaveMinutes}`;
      }
      setLeaveTime(leave);
      handleUpdate({ travelTime: value.toString(), leaveTime: leave });
    }
  }
  
  // Handle travel time update from modal
  const handleTravelTimeUpdate = (orderId: string, newTravelTime: number) => {
    if (orderId === order.id && !hasManualTravelTime && newTravelTime !== travelTime) {
      setTravelTime(newTravelTime)
      handleUpdate({ travelTime: newTravelTime.toString() })
    }
  }

  // Handle product search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to search products');
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
          ? data.products
          : [];
      setSearchResults(list as Product[]);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  // Add handleAddProduct function
  const handleAddProduct = (product: Product) => {
    const newLineItem = {
      id: Date.now().toString(), // Temporary ID for new items
      sku: product.shopifySku || product.variantSku,
      title: product.shopifyName || product.name,
      variant_id: product.variantId, // ensure product lookup works
      variantId: product.variantId,
      quantity: 1,
      price: "0.00", // You might want to fetch the actual price from your backend
      variant_title: null,
      vendor: "Cater Station",
      properties: [],
      taxable: true,
      requires_shipping: true,
      fulfillment_status: null
    }

    let currentLineItems: any[] = [];
    if (Array.isArray(order.lineItems)) {
      currentLineItems = order.lineItems;
    } else if (typeof order.lineItems === 'string' && order.lineItems) {
      try {
        currentLineItems = JSON.parse(order.lineItems);
      } catch (err) {
        console.error('Failed to parse lineItems JSON:', err, order.lineItems);
        currentLineItems = [];
      }
    }

    const updatedLineItems = [...currentLineItems, newLineItem];
    handleUpdate({ lineItems: updatedLineItems })
    setSearchQuery('')
    setSearchResults([])
  }

  // Add handleRemoveProduct function
  const handleRemoveProduct = (index: number) => {
    let currentLineItems: any[] = [];
    if (Array.isArray(order.lineItems)) {
      currentLineItems = order.lineItems;
    } else if (typeof order.lineItems === 'string' && order.lineItems) {
      try {
        currentLineItems = JSON.parse(order.lineItems);
      } catch (err) {
        console.error('Failed to parse lineItems JSON:', err, order.lineItems);
        currentLineItems = [];
      }
    }

    const updatedLineItems = currentLineItems.filter((item: any, i: number) => i !== index);
    handleUpdate({ lineItems: updatedLineItems })
  }

  // Handle opening product edit modal (with SKU or product_id fallback)
  const handleEditProduct = (sku: string | null, productTitle: string, productId?: string, variantTitle?: string) => {
    setProductEditModal({
      isOpen: true,
      sku: sku || '',
      productTitle,
      productId: productId || '',
      variantTitle: variantTitle || ''
    });
  };

  // Handle product update callback (edit or create)
  const handleProductUpdated = async (updatedProduct: ProductEditType) => {
    // If the product does not exist, create it
    if (updatedProduct.variantSku && !products[updatedProduct.variantSku]) {
      try {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        });
        if (!response.ok) throw new Error('Failed to create product');
        // Optionally, update local products state here if needed
      } catch (error) {
        console.error('Error creating product:', error);
        // Optionally, show a toast here
        return;
      }
    }
    // Update the order line item with the new/edited product info if needed
    // (You may want to update the title, etc. in the order's lineItems)
    // Optionally, show a toast here
  };

  // Helper to get a default product object for missing products
  function getDefaultProduct(sku: string, title: string): ProductEditType {
    return {
      id: '',
      name: title || '',
      description: '',
      addon: '',
      handle: '',
      meat1: '',
      meat2: '',
      option1: '',
      option2: '',
      serveware: '',
      timerA: null,
      timerB: null,
      skuSearch: '',
      variantSku: sku,
      ingredients: [],
      totalCost: 0,
      sellingPrice: 0,
      realizedMargin: 0,
    };
  }

  const customDataSchema = z.object({
    variantId: z.string().min(1, 'variantId is required'),
    displayName: z.string().optional(),
    meat1: z.string().optional(),
    meat2: z.string().optional(),
    timer1: z.number().nullable().optional(),
    timer2: z.number().nullable().optional(),
    option1: z.string().optional(),
    option2: z.string().optional(),
    serveware: z.boolean().optional(),
  });

  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isProductEditModalOpen, setIsProductEditModalOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productEditError, setProductEditError] = useState<string | null>(null);
  const [ruleSuggestions, setRuleSuggestions] = useState<any>(null);
  const [isSetRuleModalOpen, setIsSetRuleModalOpen] = useState(false);

  const productForm = useForm({
    resolver: zodResolver(customDataSchema),
    defaultValues: {
      variantId: '',
      displayName: '',
      meat1: '',
      meat2: '',
      timer1: null,
      timer2: null,
      option1: '',
      option2: '',
      serveware: false,
    },
    mode: 'onChange',
  });

  const openProductEditModal = async (product: any) => {
    if (!product || typeof product !== 'object' || !product.variantId || product.variantId === '') {
      console.error('Attempted to open modal with invalid product or missing variantId:', product);
      alert('Cannot edit this product: missing variant ID.');
      return;
    }
    const variantId = product.variantId.toString();
    console.log('Opening Product Edit Modal with product:', product);
    console.log('Product keys:', Object.keys(product));
    
    // Fetch the latest product data from the database to ensure we have the most up-to-date information
    let latestProduct = product;
    try {
      const response = await fetch(`/api/products/variant/${variantId}`);
      if (response.ok) {
        latestProduct = await response.json();
        console.log('Fetched latest product data:', latestProduct);
      }
    } catch (error) {
      console.error('Error fetching latest product data:', error);
      // Continue with the original product data if fetch fails
    }
    
    // Get rule suggestions for this variant
    try {
      const response = await fetch('/api/product-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          productTitle: latestProduct.shopifyTitle || latestProduct.shopify_title
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setRuleSuggestions(result.suggestedData);
      }
    } catch (error) {
      console.error('Error fetching rule suggestions:', error);
    }
    
    // Allow timer1 and timer2 to be null
    productForm.reset({
      variantId,
      displayName: latestProduct.displayName || '',
      meat1: latestProduct.meat1 || '',
      meat2: latestProduct.meat2 || '',
      timer1: latestProduct.timer1 ?? null,
      timer2: latestProduct.timer2 ?? null,
      option1: latestProduct.option1 || '',
      option2: latestProduct.option2 || '',
      serveware: !!latestProduct.serveware,
    });
    setEditingProduct(latestProduct);
    setIsProductEditModalOpen(true);
  };

  // Add debugging to modal render
  useEffect(() => {
    if (isProductEditModalOpen) {
      console.log('Product Edit Modal is rendering. Editing product:', editingProduct);
      console.log('Form values:', productForm.getValues());
    }
  }, [isProductEditModalOpen, editingProduct]);

  const handleProductEditSave = async (data: any) => {
    try {
      const response = await fetch(`/api/products/variant/${data.variantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update product')
      }

      const updatedProduct = await response.json()
      
      // Update the product in state
      if (updateProductInState) {
        updateProductInState(data.variantId, updatedProduct)
      }

      // Close the modal
      setIsProductEditModalOpen(false)
      
      // Refresh products if callback provided
      if (refreshProducts) {
        await refreshProducts()
      }

    } catch (error) {
      console.error('Error updating product:', error)
    }
  }

  // SMS functionality
  const handleSendSMS = async (phoneNumber: string) => {
    console.log('🚀 Frontend: handleSendSMS called with phone number:', phoneNumber);
    console.log('🚀 Frontend: Order ID:', order.id);
    console.log('🚀 Frontend: Order number:', order.orderNumber);
    
    setIsSendingSms(true);
    setSmsStatus('idle');
    setSmsMessage('');

    if (!phoneNumber.trim()) {
      console.log('❌ Frontend: No phone number provided');
      setSmsStatus('error');
      setSmsMessage('Please enter a phone number');
      setIsSendingSms(false);
      return;
    }

    try {
      console.log('📡 Frontend: Making API call to send SMS...');
      // Build Google Maps link
      const addrObj: any = typeof order.shippingAddress === 'string' ? (()=>{ try { return JSON.parse(order.shippingAddress) } catch { return {} } })() : (order.shippingAddress || {})
      const mapsQuery = encodeURIComponent([addrObj.company, addrObj.address1, addrObj.address2, addrObj.zip].filter(Boolean).join(', '))
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
      // Build items summary with SW tag (no qty)
      const itemsSummary = lineItems.map((li: any) => {
        const title = li.title || li.name || ''
        const hasSW = (li.variant_title || li.variantTitle || '').toLowerCase().includes('yes serveware')
        return `- ${title}${hasSW ? ' (SW)' : ''}`
      }).join('\n')
      // Vehicle label after order number
      const effectiveCarId = (carId || (order as any)?.carId) as string | undefined
      const selectedCar = effectiveCarId ? cars.find(c => c.id === effectiveCarId) : undefined
      const vehicleLabel = selectedCar ? ` (${selectedCar.name}${selectedCar.rego ? ` ${selectedCar.rego}` : ''})` : ''
      const smsBody = `Order #${order.orderNumber}${vehicleLabel}\nTags: ${order.tags || ''}\nCustomer: ${order.customerFirstName || ''} (${order.customerPhone || ''})\nAddress: ${[addrObj.company, addrObj.address1, addrObj.address2, addrObj.zip].filter(Boolean).join(' ')} — ${mapsUrl}\nItems:\n${itemsSummary}`
      const requestBody = { driverPhone: phoneNumber.trim(), message: smsBody };
      console.log('📡 Frontend: Request body:', requestBody);
      
      const response = await fetch(`/api/orders/${order.id}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('📡 Frontend: Response status:', response.status);
      console.log('📡 Frontend: Response ok:', response.ok);

      const data = await response.json()
      console.log('📡 Frontend: Response data:', data);

      if (response.ok) {
        console.log('✅ Frontend: SMS sent successfully');
        setSmsStatus('success');
        setSmsMessage('SMS sent successfully!');
        setIsSendingSms(false);
      } else {
        console.log('❌ Frontend: SMS failed with error:', data.error);
        setSmsStatus('error');
        setSmsMessage(data.error || 'Failed to send SMS');
        setIsSendingSms(false);
      }
    } catch (error) {
      console.error('❌ Frontend: Error sending SMS:', error)
      setSmsStatus('error')
      setSmsMessage('Failed to send SMS')
      setIsSendingSms(false);
    }
  }

  // Timer alert functionality
  const [timerAlerts, setTimerAlerts] = useState<{ [key: string]: boolean }>({});
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [lastAlertMinute, setLastAlertMinute] = useState<string>('');

  // Initialize audio context for timer alerts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);
    }
  }, []);

  // Function to play enhanced timer alert sound (3 dading sounds)
  const playTimerAlert = () => {
    if (!audioContext || !isAudioEnabled) return;
    
    // Play 3 dading sounds with slight delays
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // More impactful sound: higher frequency, longer duration
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.3);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.4);
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }, i * 200); // 200ms delay between each dading
    }
  };

  // Check timer times and trigger alerts
  useEffect(() => {
    const checkTimers = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentSecond = now.getSeconds();
      
      // Only check for alerts in the first 3 seconds of each minute
      if (currentSecond > 3) return;
      
      // Prevent multiple alerts in the same minute
      if (lastAlertMinute === currentMinute) return;
      
      let shouldAlert = false;
      const alertingItems: string[] = [];
      
      lineItems.forEach((item: any) => {
        const variantId = item.variant_id?.toString() || item.variantId?.toString();
        const product = variantId ? products[variantId] : null;
        
        if (product && leaveTime) {
          const timerTimes = calculateTimerTimes(leaveTime, product.timer1, product.timer2);
          
          timerTimes.forEach((timerTime, index) => {
            const isCurrentTime = timerTime === currentTime;
            
            if (isCurrentTime) {
              shouldAlert = true;
              const meatType = index === 0 ? product.meat1 : product.meat2;
              if (meatType) {
                alertingItems.push(meatType.toUpperCase());
              }
            }
          });
        }
      });
      
      // Play alert only once per minute if any timers are due
      if (shouldAlert) {
        playTimerAlert();
        setLastAlertMinute(currentMinute);
        console.log(`Timer alert: ${alertingItems.join(', ')} items due at ${currentTime}`);
      }
    };

    const interval = setInterval(checkTimers, 1000); // Check every second
    return () => clearInterval(interval);
  }, [lineItems, products, leaveTime, audioContext, lastAlertMinute, isAudioEnabled]); // Added isAudioEnabled to dependencies

  // Helper function to check if a timer is current time
  const isTimerCurrentTime = (variantId: string, timerIndex: number, timerTime: string) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return timerTime === currentTime;
  };

  // Helper function to check if a timer time has passed (for persistent red color)
  const isTimerPassed = (variantId: string, timerIndex: number, timerTime: string) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Convert times to minutes for comparison
    const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
    const [timerHours, timerMinutes] = timerTime.split(':').map(Number);
    
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const timerTotalMinutes = timerHours * 60 + timerMinutes;
    
    // Return true if timer time has passed (is in the past)
    return timerTotalMinutes <= currentTotalMinutes;
  };

  function safeFormatDate(dateString: string | undefined | null): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  }

  function safeFormatTime(dateString: string | undefined | null): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Order Details Section - Light Blue Background */}
      <div className={`${isTvMode ? 'bg-blue-50' : 'bg-blue-100'} text-black p-1`}>
        {/* Single row with all order details */}
        <div className={`flex flex-wrap items-center gap-2 sm:space-x-3 ${isTvMode ? 'text-4xl' : 'text-base'}`}>
          {/* Dispatch time (Leave Time) - simplified in TV mode: no icon, no box, same text size style as travel time */}
          <div className={`${isTvMode ? 'w-36' : 'w-16 sm:w-20'}`}>
            {isTvMode ? (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9: ]*"
                value={leaveTime}
                onChange={(e) => {
                  setLeaveTime(e.target.value)
                  handleUpdate({ leaveTime: e.target.value })
                }}
                className="w-full text-center font-medium text-black bg-transparent border-0 px-0 py-0 focus:outline-none focus:ring-0 appearance-none"
                title="Leave Time"
              />
            ) : (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9: ]*"
                value={leaveTime}
                onChange={(e) => {
                  setLeaveTime(e.target.value);
                  handleUpdate({ leaveTime: e.target.value });
                }}
                className="w-full text-center font-bold text-black bg-transparent border-0 px-0 py-0 focus:outline-none focus:ring-0 appearance-none text-lg sm:text-xl"
                title="Leave Time"
              />
            )}
          </div>
          <div className={`${isTvMode ? 'w-36' : 'w-24 sm:w-28'}`}>
            <div className="flex items-center">
              <input
                type="number"
                step="1"
                value={Number.isNaN(travelTime) ? 0 : travelTime}
                onChange={(e) => {
                  const numericValue = parseInt(e.target.value || '0', 10);
                  handleTravelTimeChange(Number.isNaN(numericValue) ? 0 : numericValue);
                }}
                onBlur={() => {
                  // Persist to server on blur to avoid mid-typing flicker
                  let leave = deliveryTime;
                  if (deliveryTime && travelTime > 0) {
                    const [hours, minutes] = deliveryTime.split(':').map(Number);
                    const deliveryDate = new Date();
                    deliveryDate.setHours(hours, minutes, 0, 0);
                    const leaveDate = new Date(deliveryDate.getTime() - (travelTime * 60 * 1000));
                    const leaveHours = leaveDate.getHours().toString().padStart(2, '0');
                    const leaveMinutes = leaveDate.getMinutes().toString().padStart(2, '0');
                    leave = `${leaveHours}:${leaveMinutes}`;
                  }
                  handleUpdate({ travelTime: String(travelTime), leaveTime: leave });
                }}
                className="w-16 text-center font-medium border rounded px-1 text-black appearance-none"
                placeholder="0"
              />
            </div>
          </div>
          {/* Vehicle selection (left of Driver) */}
          <div className={`${isTvMode ? 'w-40' : 'w-24 sm:w-28'}`}>
            <div className="flex items-center gap-1">
              <Car className="w-4 h-4 text-gray-500" />
              <select
                value={carId}
                onChange={(e) => {
                  const v = e.target.value
                  setCarId(v)
                  handleUpdate({ carId: v as any })
                }}
                className="w-full px-1 py-0.5 rounded bg-amber-100 text-black border border-amber-300 text-xs"
                title="Vehicle"
              >
                <option value="">No Car</option>
                {cars.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.rego ? ` • ${c.rego}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Driver selection */}
          <div className={`${isTvMode ? 'w-56' : 'w-28 sm:w-36'}`}>
            <select
              value={driverId}
              onChange={(e) => {
                setDriverId(e.target.value)
                handleUpdate({ driverId: e.target.value })
              }}
              className="w-full px-1 py-0.5 rounded bg-blue-200 text-black border border-blue-300 text-xs"
              title="Driver"
              disabled={isLoadingDrivers}
            >
              <option value="">{isLoadingDrivers ? 'Loading drivers...' : 'Select Driver'}</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>
          <div 
            className="flex-1 truncate cursor-pointer hover:underline mr-4" 
            title={deliveryAddress || 'No address available'}
            onClick={() => setIsMapModalOpen(true)}
          >
            {/* Order number and customer before address */}
            <span className="mr-3">{`#${order.orderNumber || ''}`}</span>
            <span className="mr-3">{`${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim()}</span>
            {deliveryAddress || 'No address'}
          </div>
          <div className={`${isTvMode ? 'w-48' : 'w-20 sm:w-24'} ml-2 text-right`}>
            {deliveryTime || 'Not set'}
          </div>
          <div className={`${isTvMode ? 'w-40' : 'w-20 sm:w-24'} text-center`}>
            {deliveryPhone ? (
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(true)}
                className="underline underline-offset-2 decoration-dotted hover:text-blue-700"
                title="View order details"
              >
                {deliveryPhone}
              </button>
            ) : (
              'No phone'
            )}
          </div>
          <div className="flex-1 truncate relative ml-3 text-right pr-2">
            <div
              className="cursor-pointer hover:underline"
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                const tooltip = document.createElement('div')
                tooltip.className = 'absolute z-50 bg-white border border-gray-300 shadow-lg text-sm text-black p-2 rounded max-w-sm w-fit'
                tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`
                tooltip.style.left = `${rect.left + window.scrollX}px`
                tooltip.innerText = order.note || 'No notes'

                // Close on next click anywhere
                const handleClickOutside = () => {
                  tooltip.remove()
                  document.removeEventListener('click', handleClickOutside)
                }

                setTimeout(() => document.addEventListener('click', handleClickOutside), 0)

                document.body.appendChild(tooltip)
              }}
            >
              {sanitizeOrderNote(order.note) || 'No notes'}
            </div>
          </div>
          {/* Dispatch Status Badge */}
          {order.isDispatched && (
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <Car className="h-3 w-3" />
              Dispatched
            </div>
          )}
          {/* SMS Status Message */}
          {smsMessage && (
            <div className={`absolute top-12 right-2 px-3 py-1 rounded text-xs ${
              smsStatus === 'success' 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}>
              {smsMessage}
            </div>
          )}
        </div>
      </div>

      {/* Item Details Section - White Background */}
      <div className="p-1 bg-white">
        <div className="relative">
          {/* Addon products - center area, includes pack children that are addons */}
          <div className={`hidden lg:flex absolute left-1/2 top-0 items-center space-x-2 ${isTvMode ? 'text-[2.5rem]' : 'text-[1.75rem]'} text-red-600 z-10 leading-tight`}>
            {expandedDisplayLineItems.map((item: any, index: number) => {
              const variantId = item.variant_id?.toString() || item.variantId?.toString();
              const product = variantId ? products[variantId] : null;
              const isAddon = (sku?: string) => !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
              if (!isAddon(item.sku) && !isAddon(product?.shopifySku)) return null
              return (
                <ContextMenu key={index}>
                  <ContextMenuTrigger asChild>
                    <div className="flex items-center cursor-context-menu hover:bg-gray-50 p-0.5 rounded leading-tight">
                  {index > 0 && <span className="mx-2 text-red-600">•</span>}
                  {product?.serveware && (
                    <span className="text-xs font-black text-black mr-2 align-middle">SW</span>
                  )}
                  <span>{(() => {
                    const parentDisplay = product ? (product as any).productDisplayName : undefined;
                    const fallbackName = product ? (product.shopifyName || product.shopifyTitle || product.name) : item.title;
                    const name = (parentDisplay?.trim() || '') || (fallbackName || '');
                    const qty = Number(item.quantity || 0);
                    return qty > 1 ? `${qty}x ${name}` : name;
                  })()}</span>
                </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem 
                      onClick={() => {
                        if (product) {
                          openProductEditModal(product);
                        } else {
                          console.warn('Product data not found for variant ID:', variantId);
                          alert('Product data not found for this item. Please sync products first.');
                        }
                      }}
                    >
                      Edit Product
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </div>
            
          {/* Action Buttons - right side on desktop; hidden on mobile */}
          <div className="hidden lg:flex absolute right-2 top-0 items-center gap-2 z-10">
            <PaymentAlertBadge order={order} />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                console.log('🚀 Frontend: Dispatch button clicked');
                console.log('🚀 Frontend: Current dispatch state:', order.isDispatched);
                console.log('🚀 Frontend: Driver ID:', driverId);
                console.log('🚀 Frontend: Available drivers:', drivers);
                
                try {
                  const newDispatchState = !order.isDispatched;
                  console.log('🚀 Frontend: New dispatch state will be:', newDispatchState);
                  
                  await handleUpdate({ isDispatched: newDispatchState });
                  console.log('🚀 Frontend: Order updated successfully');
                  
                  // No automatic SMS on dispatch anymore
                } catch (error) {
                  console.error('❌ Frontend: Error updating dispatch status:', error);
                }
              }}
              disabled={isSendingSms}
              className={`transition-colors ${
                order.isDispatched 
                  ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' 
                  : 'bg-white border-gray-200 hover:bg-gray-100'
              }`}
              title={
                order.isDispatched 
                  ? 'Order Dispatched' 
                  : driverId 
                    ? 'Mark as Dispatched (SMS will be sent to driver)' 
                    : 'Mark as Dispatched (select a driver to send SMS)'
              }
            >
              <Car className="h-4 w-4" />
              {isSendingSms && <span className="ml-1 text-xs">SMS...</span>}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="bg-white border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClientTextOpen(true)}
              className="bg-white border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="Text client"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const selectedDriver = drivers.find(d => d.id === driverId)
                if (!selectedDriver || !selectedDriver.phone) {
                  alert('Select a driver with a phone number first')
                  return
                }
                await handleSendSMS(selectedDriver.phone)
              }}
              disabled={!driverId}
              className="bg-white border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title={driverId ? 'Send SMS to driver' : 'Select a driver first'}
            >
              <Phone className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInternalNoteModalOpen(true)}
              className="bg-white border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="Add internal note"
            >
              <StickyNote className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setIsDDModalOpen(true)
                  // Preload quote
                  const addrObj: any = typeof order.shippingAddress === 'string' ? (()=>{ try { return JSON.parse(order.shippingAddress) } catch { return {} } })() : (order.shippingAddress || {})
                  const drop = [addrObj.address1, addrObj.address2, addrObj.city, addrObj.province, addrObj.zip, 'New Zealand'].filter(Boolean).join(', ')
                  const res = await fetch('/api/dispatch/quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pickupAddress: originAddressOverride || undefined, dropoffAddress: drop, perKmRate: ddRate }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    const km = Number(data.km || 0)
                    setDdKm(km)
                    setDdPayout(Number((ddBase + km * ddRate).toFixed(2)))
                  }
                } catch (e) {
                  console.error('quote failed', e)
                }
              }}
              className="bg-white border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="DataDriver dispatch"
            >
              DD
            </Button>
          </div>

          {/* Internal note under action buttons (desktop) */}
          {order.internalNote && (
            <div className="hidden lg:block absolute right-2 top-10 w-[340px]">
              <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-700 whitespace-pre-wrap">
                  {order.internalNote}
                </div>
              </div>
            </div>
          )}

          {/* Regular products (with pack expansion for display) - left column */}
          <div className="space-y-0 w-full lg:max-w-[38%]">
            {expandedDisplayLineItems.map((item: any, index: number) => {
              // Use variantId for product lookup instead of SKU
              const variantId = item.variant_id?.toString() || item.variantId?.toString();
              const product = variantId ? products[variantId] : null;
              
              // Debug logging for the specific variant
              if (variantId === '46104594514175') {
                console.log('🔍 Order card - variant 46104594514175:', {
                  variantId,
                  hasProduct: !!product,
                  product: product ? {
                    meat1: product.meat1,
                    meat2: product.meat2,
                    meats: (product as any).meats,
                    displayName: product.displayName
                  } : null,
                  productsMapSize: Object.keys(products).length
                });
              }
              
              const isAddon = (sku?: string) => !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
              // Skip addon products (child addons will now be excluded too)
              if (isAddon(item.sku) || isAddon(product?.shopifySku)) return null
              // Create an array of items based on quantity (pack children already multiplied)
              return Array(item.quantity).fill(null).map((_, itemIndex) => {
                // Only calculate timer times if we have a valid product with timers
                const vAny = product as any;
                const timersArr: (number | null)[] = Array.isArray(vAny?.timers) ? vAny.timers : [product?.timer1 ?? null, product?.timer2 ?? null];
                const hasTimers = timersArr.some(t => t != null);
                const timerTimes = hasTimers ? calculateTimerTimes(leaveTime, timersArr[0] ?? null, timersArr[1] ?? null) : [];
                return (
                  <ContextMenu key={`${index}-${itemIndex}`}>
                    <ContextMenuTrigger asChild>
                      <div className={`${isTvMode ? 'text-[3.5rem]' : 'text-[2.25rem]'} relative cursor-context-menu hover:bg-gray-50 p-0.5 rounded leading-tight`}>
                        <div className="flex items-center relative">
                          {/* Pack pill */}
                          {item._isPack && (
                            <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                              {(product as any)?.productDisplayName || product?.displayName || product?.shopifyName || 'Pack'}
                            </span>
                          )}
                          <span className="flex-shrink-0 w-10 text-sm font-black text-red-600">
                            {product?.serveware ? 'SW' : ''}
                          </span>
                          <span className="flex-1">{(() => {
                            if (!product) return item.title;
                            const parentDisplay = (product as any).productDisplayName;
                            const name = parentDisplay?.trim() || product.shopifyName || product.shopifyTitle || product.name || '';
                            return name;
                          })()}</span>
                        </div>
                    {(() => {
                      // Check if we have any meat values to display
                      const meatsArr = Array.isArray((product as any)?.meats) ? (product as any).meats : null;
                      const hasMeatsArray = meatsArr && meatsArr.length > 0 && meatsArr.some((m: any) => (m ?? '').toString().trim() !== '');
                      const hasMeatFields = (product?.meat1 && product.meat1.trim() !== '') || (product?.meat2 && product.meat2.trim() !== '');
                      const has = hasMeatsArray || hasMeatFields;
                      
                      if (!has && product && variantId === '46104594514175') {
                        console.log('🔍 Debug variant 46104594514175:', {
                          product,
                          meatsArr,
                          meat1: product.meat1,
                          meat2: product.meat2,
                          hasMeatsArray,
                          hasMeatFields
                        });
                      }
                      
                      return has;
                    })() && (
                          <span className="absolute left-[45%] top-0 text-black align-middle">
                        {(() => {
                          // Get meat values - prefer meats array if it has values, otherwise use meat1/meat2
                          const meatsArr = Array.isArray((product as any)?.meats) ? (product as any).meats : null;
                          const rawMeats = (meatsArr && meatsArr.length > 0 && meatsArr.some((m: any) => (m ?? '').toString().trim() !== ''))
                            ? (meatsArr as (string | null)[])
                            : [product?.meat1 ?? null, product?.meat2 ?? null];
                          const items = rawMeats
                            .map((m, idx) => ({ text: (m ?? '').toString().trim(), idx }))
                            .filter(x => x.text.length > 0);
                          return items.map((item, j) => {
                            const t = timerTimes[item.idx]
                            const overdue = typeof t === 'string' && isTimerPassed(variantId, item.idx, t)
                            return (
                            <span key={item.idx} className={overdue ? 'text-red-600 font-bold' : ''}>
                              {j > 0 && <span className="mx-1">•</span>}
                              {item.text}
                            </span>
                          )});
                        })()}
                      </span>
                    )}
                    {(() => {
                      const anyTimer = timerTimes.some(t => t)
                      if (!anyTimer) return null
                      return (
                        <span className={`absolute left-[62%] top-0 text-blue-500 ${isTvMode ? 'text-[2rem]' : 'text-[1.4rem]'} font-medium align-middle whitespace-nowrap`}>
                          {timerTimes.map((time, i) => (
                            <span key={i} className={time && isTimerPassed(variantId, i, time) ? 'text-red-600 font-bold' : ''}>
                              {i > 0 && <span className="mx-1">•</span>}
                              {time || ''}
                            </span>
                          ))}
                        </span>
                      )
                    })()}
                    {/* Options inline with product */}
                    {(() => {
                      const optionsArr = Array.isArray((product as any)?.options) ? (product as any).options as string[] : [product?.option1, product?.option2].filter(Boolean) as string[];
                      return optionsArr.length > 0;
                    })() && (
                      <span className={`absolute left-[78%] top-0 text-blue-500 ${isTvMode ? 'text-[2rem]' : 'text-[1.4rem]'} align-middle whitespace-nowrap`}>
                        {(() => {
                          const optionsArr = Array.isArray((product as any)?.options) ? (product as any).options as string[] : [product?.option1, product?.option2].filter(Boolean) as string[];
                          return optionsArr.map((o, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-1">•</span>}
                              {o}
                            </span>
                          ));
                        })()}
                      </span>
                    )}
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem 
                        onClick={() => {
                          console.log('Full line item for debugging:', item);
                          console.log('Debug product lookup:', {
                            lineItem: item,
                            variant_id: item.variant_id,
                            variantId: item.variantId,
                            variant_id_string: variantId,
                            productFound: !!product,
                            productsMapKeys: Object.keys(products).slice(0, 5), // Show first 5 keys
                            lookupKey: variantId
                          });
                          if (product) {
                            openProductEditModal(product);
                          } else {
                            // Optionally show a toast or alert
                            console.warn('Product data not found for variant ID:', variantId);
                            alert('Product data not found for this item. Please sync products first.');
                          }
                        }}
                      >
                        Edit Product
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              });
            })}
          </div>
          
          {/* Mobile actions row (shown when desktop actions are hidden) */}
          <div className="mt-2 flex lg:hidden items-center gap-2">
            <PaymentAlertBadge order={order} />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const newDispatchState = !order.isDispatched;
                  await handleUpdate({ isDispatched: newDispatchState });
                } catch (error) {
                  console.error('Error updating dispatch status:', error);
                }
              }}
              disabled={isSendingSms}
            >
              <Car className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>Edit</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const selectedDriver = drivers.find(d => d.id === driverId)
                if (!selectedDriver || !selectedDriver.phone) {
                  alert('Select a driver with a phone number first')
                  return
                }
                await handleSendSMS(selectedDriver.phone)
              }}
              disabled={!driverId}
              title={driverId ? 'Send SMS to driver' : 'Select a driver first'}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Internal note under buttons (mobile) */}
          {order.internalNote && (
            <div className="lg:hidden mt-2 w-full">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-700 whitespace-pre-wrap">
                  {order.internalNote}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Order Modal */}
      <Dialog modal open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-full max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby="edit-order-description">
          <DialogHeader>
            <DialogTitle>Edit Order #{order.orderNumber}</DialogTitle>
            <DialogDescription id="edit-order-description">
              Edit order details and manage items. Changes will be saved to the database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Order Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="delivery-date">Delivery Date</label>
                <input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="delivery-time">Delivery Time</label>
                <Input
                  id="delivery-time"
                  type="time"
                  value={extractFirstTimeTo24Hour(deliveryTime)}
                  onChange={(e) => {
                    const newDeliveryTime = e.target.value;
                    setDeliveryTime(newDeliveryTime);
                    // Recalculate leaveTime
                    let leave = newDeliveryTime;
                    if (newDeliveryTime && travelTime > 0) {
                      const [hours, minutes] = newDeliveryTime.split(':').map(Number);
                      const deliveryDateObj = new Date();
                      deliveryDateObj.setHours(hours, minutes, 0, 0);
                      const leaveDate = new Date(deliveryDateObj.getTime() - (travelTime * 60 * 1000));
                      const leaveHours = leaveDate.getHours().toString().padStart(2, '0');
                      const leaveMinutes = leaveDate.getMinutes().toString().padStart(2, '0');
                      leave = `${leaveHours}:${leaveMinutes}`;
                    }
                    setLeaveTime(leave);
                  }}
                  aria-label="Delivery time"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="leave-time">Leave Time</label>
                <Input
                  id="leave-time"
                  type="time"
                  value={leaveTime}
                  onChange={(e) => setLeaveTime(e.target.value)}
                  aria-label="Leave time"
                />
              </div>
            </div>

            {/* Delivery Address & Company */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Address</label>
              <Input
                placeholder="Company (optional)"
                value={(typeof order.shippingAddress === 'string' ? (()=>{ try { return (JSON.parse(order.shippingAddress) as any).company || '' } catch { return '' } })() : (order.shippingAddress as any)?.company) || ''}
                onChange={(e) => {
                  const companyVal = e.target.value
                  const addrObj: any = typeof order.shippingAddress === 'string' ? (()=>{ try { return JSON.parse(order.shippingAddress) } catch { return {} } })() : (order.shippingAddress || {})
                  handleUpdate({ shippingAddress: { ...addrObj, company: companyVal } as any })
                }}
              />
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Order Notes</label>
              <textarea
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any special instructions..."
              />
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Order Items</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsSearching(true);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  Add Item
                </Button>
              </div>

              <div className="border rounded-md divide-y">
                {editedLineItems.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Qty:</span>
                        <Input
                          type="number"
                          min="1"
                          className="w-16"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value);
                            if (newQuantity > 0) {
                              const updatedLineItems = [...editedLineItems];
                              updatedLineItems[index] = { ...item, quantity: newQuantity };
                              setEditedLineItems(updatedLineItems);
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const updatedLineItems = [...editedLineItems];
                          updatedLineItems.splice(index, 1);
                          setEditedLineItems(updatedLineItems);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  setIsLoading(true);
                  await handleUpdate({
                    deliveryDate,
                    deliveryTime,
                    leaveTime,
                    travelTime: travelTime.toString(),
                    note,
                    shippingAddress: {
                      ...order.shippingAddress,
                      address1: address
                    },
                    lineItems: editedLineItems
                  });
                  setIsEditModalOpen(false);
                } catch (error) {
                  console.error('Error saving changes:', error);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Search Dialog */}
      <Dialog modal open={isSearching} onOpenChange={setIsSearching}>
        <DialogContent aria-describedby="search-products-description">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription id="search-products-description">
              Search for products to add to this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-[300px] overflow-auto">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium">{(() => {
                        if (product.displayName?.trim()) return product.displayName
                        const name = product.shopifyName
                        if (name && name !== 'Default Title') return name
                        return product.shopifyTitle || product.name
                      })()}</div>
                      <div className="text-sm text-gray-500">
                        SKU: {product.shopifySku || product.variantSku}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const newItem = {
                          sku: product.shopifySku || product.variantSku,
                          title: (product.shopifyName && product.shopifyName !== 'Default Title') ? product.shopifyName : (product.shopifyTitle || product.name),
                          variant_id: product.variantId,
                          variantId: product.variantId,
                          quantity: 1,
                          price: "0.00",
                          variant_title: null,
                          vendor: "Cater Station",
                          properties: [],
                          taxable: true,
                          requires_shipping: true,
                          fulfillment_status: null
                        } as any;
                        const updatedLineItems = [...editedLineItems, newItem];
                        handleUpdate({ lineItems: updatedLineItems });
                        setIsSearching(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Map Modal */}
      <DeliveryMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        deliveryAddress={deliveryAddress}
        orderId={order.id}
        onUpdateTravelTime={handleTravelTimeUpdate}
        hasManualTravelTime={hasManualTravelTime}
        originAddressOverride={originAddressOverride}
        driverId={order.driverId || undefined}
        deliveryDate={order.deliveryDate || undefined}
        deliveryTime={order.deliveryTime || undefined}
        leaveTime={order.leaveTime || undefined}
        orderNumber={order.orderNumber ? Number(order.orderNumber) : undefined}
        customerName={`${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || undefined}
      />
      <TextOrdersModal
        isOpen={isClientTextOpen}
        onClose={() => setIsClientTextOpen(false)}
        orders={[order]}
        defaultTemplate="delivery"
        presetSelection={[order.id]}
      />

      {/* DataDriver Dispatch Modal */}
      <Dialog modal open={isDDModalOpen} onOpenChange={setIsDDModalOpen}>
        <DialogContent className="w-full max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispatch to DataDrivers — #{order.orderNumber}</DialogTitle>
            <DialogDescription>Review dispatch time and payrate, then send offer to available drivers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dd-dispatch" className="text-sm font-medium">Dispatch time</Label>
                <Input
                  id="dd-dispatch"
                  type="time"
                  value={ddDispatchTime}
                  onChange={(e) => setDdDispatchTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dd-rate" className="text-sm font-medium">$ per km</Label>
                <Input
                  id="dd-rate"
                  type="number"
                  step="0.1"
                  value={ddRate}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value || '0') || 0
                    setDdRate(v)
                    setDdPayout(Number((ddBase + ddKm * v).toFixed(2)))
                  }}
                />
              </div>
              <div>
                <Label htmlFor="dd-base" className="text-sm font-medium">Base pay</Label>
                <Input
                  id="dd-base"
                  type="number"
                  step="0.5"
                  value={ddBase}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value || '0') || 0
                    setDdBase(v)
                    setDdPayout(Number((v + ddKm * ddRate).toFixed(2)))
                  }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Estimated distance</Label>
                <div className="mt-2 text-sm">{ddKm.toFixed(1)} km</div>
              </div>
              <div>
                <Label htmlFor="dd-payout" className="text-sm font-medium">Payrate</Label>
                <Input
                  id="dd-payout"
                  type="number"
                  step="0.1"
                  value={ddPayout}
                  onChange={(e) => setDdPayout(parseFloat(e.target.value || '0') || 0)}
                />
              </div>
            </div>
            {/* Basic order details summary */}
            {(() => {
              const addrObj: any =
                typeof order.shippingAddress === 'string'
                  ? (() => { try { return JSON.parse(order.shippingAddress) } catch { return {} } })()
                  : (order.shippingAddress || {})
              const company = addrObj.company || ''
              const itemsCount = Array.isArray(order.lineItems)
                ? order.lineItems.reduce((a: number, li: any) => a + Number(li.quantity || 0), 0)
                : 0
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Item count</div>
                    <div className="font-medium">{itemsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Delivery suburb</div>
                    <div className="font-medium">{addrObj.city || addrObj.province || '—'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500">Company</div>
                    <div className="font-medium">{company || '—'}</div>
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDDModalOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch('/api/dispatch/jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id, payout: ddPayout, dispatchTime: ddDispatchTime }),
                  })
                  if (!res.ok) {
                    const t = await res.text().catch(()=> '')
                    alert(`Failed to send offers: ${t}`)
                    return
                  }
                  setIsDDModalOpen(false)
                } catch (e) {
                  console.error('send offers failed', e)
                  alert('Failed to send offers.')
                }
              }}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Order Details Modal (opens when clicking phone number) */}
      <Dialog modal open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details #{order.orderNumber}</DialogTitle>
            <DialogDescription>
              Quick view of customer and delivery details.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const addrObj: any =
              typeof order.shippingAddress === 'string'
                ? (() => {
                    try { return JSON.parse(order.shippingAddress) }
                    catch { return {} }
                  })()
                : (order.shippingAddress || {})
            const company = addrObj.company || ''
            const address1 = addrObj.address1 || ''
            const address2 = addrObj.address2 || ''
            const displayTime = formatTimeForDisplay(deliveryTime || order.deliveryTime || '')
            const items: Array<{ key: string; qty: number; name: string; hasSW: boolean }> = (() => {
              let base: any[] = []
              if (Array.isArray(order.lineItems)) base = order.lineItems
              else if (typeof order.lineItems === 'string' && order.lineItems) {
                try { base = JSON.parse(order.lineItems) } catch { base = [] }
              }
              return base.map((it: any, idx: number) => {
                const variantId = it.variant_id?.toString() || it.variantId?.toString()
                const product = variantId ? (products as any)[variantId] : null
                const productName = (() => {
                  if (product?.displayName?.trim()) return product.displayName
                  const n = product?.shopifyName
                  if (n && n !== 'Default Title') return n
                  return product?.shopifyTitle || product?.name || it.title || ''
                })()
                const qty = Number(it.quantity || 1)
                const hasSW = !!(product?.serveware) || ((it.variant_title || it.variantTitle || '').toLowerCase().includes('yes serveware'))
                return { key: `${variantId || it.id || idx}`, qty, name: productName, hasSW }
              })
            })()
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Customer first name</div>
                    <div className="font-medium">{order.customerFirstName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Customer last name</div>
                    <div className="font-medium">{order.customerLastName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <div className="font-medium">
                      {order.customerPhone ? (
                        <a href={`tel:${order.customerPhone}`} className="text-blue-700 hover:underline">
                          {order.customerPhone}
                        </a>
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Delivery time</div>
                    <div className="font-medium">{displayTime || 'N/A'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-gray-500">Delivery instructions</div>
                    <div className="font-medium whitespace-pre-wrap">{(order as any).deliveryInstructions || '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-gray-500">Order note</div>
                    <div className="font-medium whitespace-pre-wrap">{order.note || '—'}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Company</div>
                  <div className="font-medium">{company || '—'}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Address line 1</div>
                    <div className="font-medium">{address1 || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Address line 2</div>
                    <div className="font-medium">{address2 || '—'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">Items</div>
                  {items.length === 0 ? (
                    <div className="text-sm text-gray-600">No items</div>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {items.map((it) => (
                        <li key={it.key} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center min-w-0">
                            <span className="flex-shrink-0 w-10 text-sm font-black text-red-600">{it.hasSW ? 'SW' : ''}</span>
                            <span className="truncate">{it.name}</span>
                          </div>
                          <span className="ml-3 text-sm text-gray-600">x{it.qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit Modal */}
      <Dialog open={isProductEditModalOpen} onOpenChange={setIsProductEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product Custom Data</DialogTitle>
            <DialogDescription>
              Shopify data is read-only. Edit custom fields below.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="mb-4 p-2 bg-gray-50 rounded">
              <div><b>Shopify Title:</b> {editingProduct.shopifyTitle || editingProduct.shopify_title}</div>
              <div><b>SKU:</b> {editingProduct.shopifySku || editingProduct.shopify_sku}</div>
              <div><b>Price:</b> ${editingProduct.shopifyPrice || editingProduct.shopify_price}</div>
              <div><b>Variant ID:</b> {editingProduct.variantId}</div>
            </div>
          )}
          
          {/* Rule Suggestions */}
          {ruleSuggestions && Object.keys(ruleSuggestions).length > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-700 mb-2">💡 Rule Suggestions</div>
            <div className="text-xs text-blue-600 space-y-1">
                {ruleSuggestions.meat1 && <div>• Meat 1: <span className="font-medium">{ruleSuggestions.meat1}</span></div>}
                {ruleSuggestions.meat2 && <div>• Meat 2: <span className="font-medium">{ruleSuggestions.meat2}</span></div>}
                {ruleSuggestions.timer1 && <div>• Timer 1: <span className="font-medium">{ruleSuggestions.timer1} min</span></div>}
                {ruleSuggestions.timer2 && <div>• Timer 2: <span className="font-medium">{ruleSuggestions.timer2} min</span></div>}
                {ruleSuggestions.option1 && <div>• Option 1: <span className="font-medium">{ruleSuggestions.option1}</span></div>}
                {ruleSuggestions.option2 && <div>• Option 2: <span className="font-medium">{ruleSuggestions.option2}</span></div>}
                {ruleSuggestions.serveware !== undefined && (
                  <div>• Serveware: <span className="font-medium">{ruleSuggestions.serveware ? 'Yes' : 'No'}</span></div>
                )}
              </div>
              <div className="text-xs text-blue-500 mt-2">
                These suggestions are based on automatic rules. You can override them below.
              </div>
            </div>
          )}
          
          <form onSubmit={productForm.handleSubmit(handleProductEditSave)} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label htmlFor="displayName">Display Name (optional)</Label>
                <Input id="displayName" {...productForm.register('displayName')} placeholder="Override product name for this variant" />
              </div>
              <div>
                <Label htmlFor="meat1">Meat 1</Label>
                <Input id="meat1" {...productForm.register('meat1')} />
              </div>
              <div>
                <Label htmlFor="meat2">Meat 2</Label>
                <Input id="meat2" {...productForm.register('meat2')} />
              </div>
              <div>
                <Label htmlFor="option1">Option 1</Label>
                <Input id="option1" {...productForm.register('option1')} />
              </div>
              <div>
                <Label htmlFor="option2">Option 2</Label>
                <Input id="option2" {...productForm.register('option2')} />
              </div>
              <div>
                <Label htmlFor="timer1">Timer 1</Label>
                <Input id="timer1" type="number" {...productForm.register('timer1', { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="timer2">Timer 2</Label>
                <Input id="timer2" type="number" {...productForm.register('timer2', { valueAsNumber: true })} />
              </div>
              <div className="col-span-2 flex items-center gap-3 mt-2">
                <input id="serveware" type="checkbox" {...productForm.register('serveware')} className="h-5 w-5 accent-blue-600 rounded border-gray-300" />
                <Label htmlFor="serveware" className="text-base font-medium select-none cursor-pointer">Include Serveware</Label>
              </div>
            </div>
            {productEditError && <div className="text-red-600">{productEditError}</div>}
            <div className="flex justify-between items-center mt-4">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setIsSetRuleModalOpen(true)}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Set Rule
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsProductEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingProduct}>
                  {isSavingProduct ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Rule Modal */}
      <SetRuleModal 
        isOpen={isSetRuleModalOpen}
        onClose={() => setIsSetRuleModalOpen(false)}
        onRuleApplied={(result) => {
          console.log('Rule applied:', result);
          // Refresh products to show updated data
          if (refreshProducts) {
            refreshProducts();
          }
        }}
      />

      {/* Internal Note Modal */}
      <Dialog open={isInternalNoteModalOpen} onOpenChange={setIsInternalNoteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Internal Note</DialogTitle>
            <DialogDescription>
              Add an internal note for this order. This note is only visible to staff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="internalNote">Note</Label>
              <textarea
                id="internalNote"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="w-full h-32 p-2 border border-gray-300 rounded-md resize-none"
                placeholder="Enter internal note..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsInternalNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={async () => {
                try {
                  await handleUpdate({ internalNote });
                  setIsInternalNoteModalOpen(false);
                } catch (error) {
                  console.error('Error updating internal note:', error);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Remove delivery date/time tokens from public order notes
function sanitizeOrderNote(raw?: string | null): string {
  if (!raw) return ''
  let s = raw
  s = s.replace(/\|\s*Delivery Date:[^|\n]+/gi, '')
  s = s.replace(/\|\s*Delivery Time:[^|\n]+/gi, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

// Helper function to get time since order
function getTimeSinceOrder(dateString: string): string {
  const orderDate = new Date(dateString);
  if (isNaN(orderDate.getTime())) return 'N/A';
  const now = new Date();
  const diffMs = now.getTime() - orderDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) {
    return `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    return `${diffDays} days ago`;
  }
}

// Helper function to get status badge color
function getStatusColor(status: string | null): string {
  switch (status) {
    case 'fulfilled':
      return 'bg-green-100 text-green-800'
    case 'partial':
      return 'bg-yellow-100 text-yellow-800'
    case 'unfulfilled':
    default:
      return 'bg-red-100 text-red-800'
  }
}

// Helper function to extract company name from shipping address
function extractCompanyName(address: any): string {
  if (!address) return ''
  
  try {
    const addr = typeof address === 'string' ? JSON.parse(address) : address
    
    if (addr.company) {
      return addr.company
    }
    
    return ''
  } catch (error) {
    console.error('Error parsing company name:', error)
    return ''
  }
}

// Helper function to extract delivery address
function extractDeliveryAddress(address: any): string {
  if (!address) return ''
  
  try {
    const addr = typeof address === 'string' ? JSON.parse(address) : address
    const parts = [
      addr.address1,
      addr.address2,
      addr.city,
      addr.province,
      addr.zip,
      'New Zealand'
    ].filter((p: string) => !!p && String(p).trim().length > 0)
    if (parts.length > 0) return parts.join(', ')
    return JSON.stringify(addr)
  } catch (error) {
    console.error('Error parsing address:', error)
    return ''
  }
} 