'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Order } from '@/types/order'
import OrderCard from './order-card'
import { Button } from '@/components/ui/button'
import { Loader2, Volume2, VolumeX, Printer, ListChecks } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { fetchProductsWithBundles, clearProductCache } from '@/lib/product-service'
import { format } from 'date-fns'
import { RunsheetModal } from '@/components/RunsheetModal'
import { TextOrdersModal } from '@/components/TextOrdersModal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { DeliveryNotesButton } from './delivery-notes-modal'
import { PaymentAlertBadge } from './payment-alert-badge'
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes'
interface OrderCardListProps {
  orders: Order[]
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => Promise<Order>
  onBulkUpdateComplete?: () => void // Optional callback for parent to re-fetch orders
  selectedDate?: Date // Date for printing labels
  originAddressOverride?: string
  isTvMode?: boolean
  compactFonts?: boolean
  mobileSimpleList?: boolean
  /** Native app: always use compact cards, never full OrderCard tables */
  forceCompactOnly?: boolean
}

type LabelSelectionItem = {
  key: string
  orderNumber: number
  productTitle: string
}

// Global audio state - shared across all order cards
export const useAudioState = () => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  
  return {
    isAudioEnabled,
    setIsAudioEnabled
  }
}

function safeFormatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

export default function OrderCardList({ orders, onUpdateOrder, onBulkUpdateComplete, selectedDate, originAddressOverride, isTvMode = false, compactFonts = false, mobileSimpleList = false, forceCompactOnly = false }: OrderCardListProps) {
  const [filter, setFilter] = useState<'all' | 'undispatched' | 'unfulfilled' | 'fulfilled'>('undispatched')
  const [isUpdatingTravelTimes, setIsUpdatingTravelTimes] = useState(false)
  const [products, setProducts] = useState<Record<string, any>>({})
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [recentlyDispatchedOrders, setRecentlyDispatchedOrders] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  
  // Audio state
  const { isAudioEnabled, setIsAudioEnabled } = useAudioState()

  // Delivery address notes (persistent, per address + client)
  const { notesByOrderId: deliveryNotesByOrderId, updateOrderNotes: updateDeliveryNotes } = useDeliveryNotes(orders)
  const [isRunsheetOpen, setIsRunsheetOpen] = useState(false)
  const [isTextModalOpen, setIsTextModalOpen] = useState(false)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [isLoadingLabelCandidates, setIsLoadingLabelCandidates] = useState(false)
  const [labelCandidates, setLabelCandidates] = useState<LabelSelectionItem[]>([])
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([])

  // Track previous product count to detect updates
  const previousProductCountRef = useRef<number>(0)

  // Function to refresh products data (silent background refresh)
  const refreshProducts = async () => {
    // Don't show loading state - refresh silently in background
    try {
      // Clear the product cache to ensure we get the latest data
      clearProductCache()
      
      // Add a small delay to ensure database updates have been applied
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Get all unique variantIds from all orders
      const uniqueVariantIds = new Set<string>()
      orders.forEach(order => {
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
        lineItems.forEach((item: any) => {
          // Try multiple possible field names for variant ID
          const variantId = item.variant_id || item.variantId || item.variantid;
          if (variantId) {
            // Shopify API may use variant_id (number), so convert to string
            const variantIdString = variantId.toString();
            uniqueVariantIds.add(variantIdString);
          }
        })
      })
      
      if (uniqueVariantIds.size > 0) {
        const variantIdsArray = Array.from(uniqueVariantIds)
        const { products: fetchedProducts } = await fetchProductsWithBundles(variantIdsArray)
        const newProductCount = Object.keys(fetchedProducts).length
        const previousCount = previousProductCountRef.current
        
        // Only flash/show notification if there are actual updates (not initial load)
        if (previousCount > 0 && newProductCount !== previousCount) {
          // Flash effect - add a class to the container that will be removed after animation
          const container = document.querySelector('.order-cards-container')
          if (container) {
            container.classList.add('flash-update')
            setTimeout(() => container.classList.remove('flash-update'), 1000)
          }
          
          toast({
            title: 'Products updated',
            description: `Updated product data for ${newProductCount} products`,
            duration: 2000,
          })
        }
        
        previousProductCountRef.current = newProductCount
        setProducts(fetchedProducts)
      }
    } catch (error) {
      console.error('Error refreshing products:', error)
      // Only show error toast, not loading states
      toast({
        title: 'Error refreshing products',
        description: 'Failed to refresh product information',
        variant: 'destructive',
      })
    }
  }

  // Function to refresh both products and orders data
  const refreshAllData = async () => {
    await refreshProducts()
    if (onBulkUpdateComplete) {
      onBulkUpdateComplete()
    }
  }

  // Function to update a single product in the products state
  const updateProductInState = (variantId: string, updatedProduct: any) => {
    setProducts(prevProducts => ({
      ...prevProducts,
      [variantId]: updatedProduct
    }));
  }

  // Real-time oven count updates
  const [currentTime, setCurrentTime] = useState(new Date());
  const currentTimeRef = useRef(new Date());

  // Update current time every 10 seconds for more responsive updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = new Date();
      setCurrentTime(newTime);
      currentTimeRef.current = newTime;
    }, 10000); // Update every 10 seconds for better responsiveness

    return () => clearInterval(interval);
  }, []);

  // Helper function to calculate timer times (copied from order-card.tsx)
  const calculateTimerTimes = (leaveTime: string, timer1?: number | null, timer2?: number | null): string[] => {
    if (!leaveTime) return [];
    
    // Skip calculation if both timers are null/undefined
    if (timer1 === null && timer2 === null) return [];
    if (timer1 === undefined && timer2 === undefined) return [];
    
    const [hours, minutes] = leaveTime.split(':').map(Number);
    const leaveTimeInMinutes = hours * 60 + minutes;
    
    const timerTimes: string[] = [];
    
    if (timer1) {
      const timer1TimeInMinutes = leaveTimeInMinutes - timer1;
      const timer1Hours = Math.floor(timer1TimeInMinutes / 60);
      const timer1Minutes = timer1TimeInMinutes % 60;
      const timer1Time = `${timer1Hours.toString().padStart(2, '0')}:${timer1Minutes.toString().padStart(2, '0')}`;
      timerTimes.push(timer1Time);
    }
    
    if (timer2) {
      const timer2TimeInMinutes = leaveTimeInMinutes - timer2;
      const timer2Hours = Math.floor(timer2TimeInMinutes / 60);
      const timer2Minutes = timer2TimeInMinutes % 60;
      const timer2Time = `${timer2Hours.toString().padStart(2, '0')}:${timer2Minutes.toString().padStart(2, '0')}`;
      timerTimes.push(timer2Time);
    }
    
    return timerTimes;
  };

  // Function to calculate oven count (items currently in the oven - timers have been triggered)
  const calculateOvenCount = () => {
    const ovenItems: { [key: string]: number } = {};
    const now = currentTimeRef.current; // Use the ref instead of state
    const currentTimeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    orders.forEach(order => {
      // Skip dispatched orders
      if (order.isDispatched) return;
      
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
      
      lineItems.forEach((item: any) => {
        const variantId = item.variant_id?.toString() || item.variantId?.toString();
        const product = variantId ? products[variantId] : null;
        
        if (product && (product.timer1 || product.timer2) && order.leaveTime) {
          // Calculate when each timer should trigger
          const timerTimes = calculateTimerTimes(order.leaveTime, product.timer1, product.timer2);
          
          // Check if any timer has been triggered (is in the past or current minute)
          const hasActiveTimer = timerTimes.some((timerTime, index) => {
            const meatType = index === 0 ? product.meat1 : product.meat2;
            if (!meatType) return false;
            
            // Convert timer time to minutes for comparison
            const [timerHours, timerMinutes] = timerTime.split(':').map(Number);
            const [currentHours, currentMinutes] = currentTimeString.split(':').map(Number);
            
            const timerTotalMinutes = timerHours * 60 + timerMinutes;
            const currentTotalMinutes = currentHours * 60 + currentMinutes;
            
            // Timer is active if it's in the past (meat is in oven)
            return timerTotalMinutes <= currentTotalMinutes;
          });
          
          if (hasActiveTimer) {
            // Count meat1 items that are in the oven
            if (product.meat1) {
              const timer1Time = timerTimes[0];
              if (timer1Time) {
                const [timerHours, timerMinutes] = timer1Time.split(':').map(Number);
                const [currentHours, currentMinutes] = currentTimeString.split(':').map(Number);
                const timerTotalMinutes = timerHours * 60 + timerMinutes;
                const currentTotalMinutes = currentHours * 60 + currentMinutes;
                
                if (timerTotalMinutes <= currentTotalMinutes) {
                  const meatKey = product.meat1.toUpperCase();
                  ovenItems[meatKey] = (ovenItems[meatKey] || 0) + (item.quantity || 1);
                }
              }
            }
            
            // Count meat2 items that are in the oven
            if (product.meat2) {
              const timer2Time = timerTimes[1];
              if (timer2Time) {
                const [timerHours, timerMinutes] = timer2Time.split(':').map(Number);
                const [currentHours, currentMinutes] = currentTimeString.split(':').map(Number);
                const timerTotalMinutes = timerHours * 60 + timerMinutes;
                const currentTotalMinutes = currentHours * 60 + currentMinutes;
                
                if (timerTotalMinutes <= currentTotalMinutes) {
                  const meatKey = product.meat2.toUpperCase();
                  ovenItems[meatKey] = (ovenItems[meatKey] || 0) + (item.quantity || 1);
                }
              }
            }
          }
        }
      });
    });
    
    return ovenItems;
  };

  // Calculate oven count
  const ovenCount = calculateOvenCount();
  const ovenCountString = Object.entries(ovenCount)
    .map(([meat, count]) => `${meat}${count}`)
    .join(' ');

  // Recalculate oven count when current time changes
  const realTimeOvenCount = useMemo(() => {
    const count = calculateOvenCount();
    return count;
  }, [orders, products, currentTime]);

  const realTimeOvenCountString = Object.entries(realTimeOvenCount)
    .map(([meat, count]) => `${meat}${count}`)
    .join(' ');

  // Local state to track orders for optimistic updates
  const [localOrders, setLocalOrders] = useState<Order[]>(orders)

  // Update local orders when orders prop changes
  useEffect(() => {
    setLocalOrders(orders)
  }, [orders])

  // Memoize the onUpdateOrder function to prevent unnecessary re-renders
  const memoizedOnUpdateOrder = useMemo(() => {
    return async (orderId: string, updates: Partial<Order>): Promise<Order> => {
      // Optimistically update local state immediately
      setLocalOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, ...updates }
            : order
        )
      )
      
      try {
        const result = await onUpdateOrder(orderId, updates);
        
        // Update local state with the server response to ensure consistency
        setLocalOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? result
              : order
          )
        )
        
        // If the order was just dispatched, add it to recently dispatched set
        if (updates.isDispatched === true) {
          setRecentlyDispatchedOrders(prev => new Set([...prev, orderId]));
          
          // Remove from recently dispatched set after 1 second
          setTimeout(() => {
            setRecentlyDispatchedOrders(prev => {
              const newSet = new Set(prev);
              newSet.delete(orderId);
              return newSet;
            });
          }, 1000);
        }
        
        return result;
      } catch (error) {
        // Revert optimistic update on error
        setLocalOrders(orders)
        console.error('Error updating order:', error);
        toast({
          title: 'Error updating order',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
          variant: 'destructive',
        });
        throw error;
      }
    };
  }, [onUpdateOrder, toast, orders]);

  // Memoize the filtered and sorted orders to prevent unnecessary re-renders
  const { filteredOrders, sortedOrders } = useMemo(() => {
    // Use localOrders for immediate updates, fallback to orders
    const ordersToUse = localOrders.length > 0 ? localOrders : orders
    // Ensure orders is an array before filtering
    if (!Array.isArray(ordersToUse)) {
      console.warn('Orders is not an array:', ordersToUse);
      return { filteredOrders: [], sortedOrders: [] };
    }
    
    // Filter orders based on fulfillment status and dispatch status
    const filtered = ordersToUse.filter(order => {
      if (filter === 'all') return true;
      if (filter === 'undispatched') {
        // Show undispatched orders OR recently dispatched orders (for 1 second flash)
        return !order.isDispatched || recentlyDispatchedOrders.has(order.id);
      }
      if (filter === 'unfulfilled') return order.fulfillmentStatus !== 'fulfilled';
      if (filter === 'fulfilled') return order.fulfillmentStatus === 'fulfilled';
      return true;
    });

    // Sort orders by dispatch time (earliest first)
    const sorted = [...filtered].sort((a, b) => {
      // Calculate dispatch time: delivery time - travel time
      const getDispatchTime = (order: Order) => {
        // Extract delivery time from order - use deliveryTime field first, then fallback to tags
        const deliveryTime = order.deliveryTime || 
          order.tags?.match(/(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)/)?.[1];
        
        if (!deliveryTime) return null;
        
        // Parse time - handle both 24-hour format (16:30) and 12-hour format (9:00 AM)
        let timeMatch = deliveryTime.match(/(\d{1,2}:\d{2})\s*([AP]M)/);
        let deliveryTimeStr;
        
        if (timeMatch) {
          // 12-hour format like "9:00 AM"
          deliveryTimeStr = timeMatch[1] + ' ' + timeMatch[2];
        } else {
          // 24-hour format like "16:30"
          timeMatch = deliveryTime.match(/(\d{1,2}:\d{2})/);
          if (timeMatch) {
            deliveryTimeStr = timeMatch[1];
          } else {
            return null;
          }
        }
        
        // Convert delivery time to minutes since midnight
        const deliveryDate = new Date(`2000-01-01 ${deliveryTimeStr}`);
        if (isNaN(deliveryDate.getTime())) return null;
        const deliveryMinutes = deliveryDate.getHours() * 60 + deliveryDate.getMinutes();
        
        // Get travel time in minutes
        const travelTimeMinutes = order.travelTime ? parseInt(order.travelTime) : 0;
        
        // Calculate dispatch time: delivery time - travel time
        const dispatchMinutes = deliveryMinutes - travelTimeMinutes;
        
        return dispatchMinutes;
      };
      
      const dispatchTimeA = getDispatchTime(a);
      const dispatchTimeB = getDispatchTime(b);
      
      // Debug logging for first few orders
      if (Math.random() < 0.05) { // Only log 5% of the time to avoid spam
        console.log('🔍 Sorting debug:', {
          orderA: a.orderNumber,
          deliveryTimeA: a.deliveryTime,
          dispatchTimeA,
          orderB: b.orderNumber,
          deliveryTimeB: b.deliveryTime,
          dispatchTimeB
        });
      }
      
      // If both have dispatch times, compare them
      if (dispatchTimeA !== null && dispatchTimeB !== null) {
        return dispatchTimeA - dispatchTimeB;
      }
      
      // If only one has dispatch time, prioritize the one with dispatch time
      if (dispatchTimeA !== null && dispatchTimeB === null) return -1;
      if (dispatchTimeA === null && dispatchTimeB !== null) return 1;
      
      // If neither has dispatch time, fall back to creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { filteredOrders: filtered, sortedOrders: sorted };
  }, [localOrders, orders, filter, recentlyDispatchedOrders]);

  // Fetch all unique products for all orders
  useEffect(() => {
    const fetchAllProducts = async () => {
      if (isInitialLoad) {
        setIsLoadingProducts(true)
      }
      try {
        // Get all unique variantIds from all orders
        const uniqueVariantIds = new Set<string>()
        orders.forEach(order => {
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
          lineItems.forEach((item: any) => {
            // Try multiple possible field names for variant ID
            const variantId = item.variant_id || item.variantId || item.variantid;
            if (variantId) {
              // Shopify API may use variant_id (number), so convert to string
              const variantIdString = variantId.toString();
              uniqueVariantIds.add(variantIdString);
            } else {
              // silent
            }
          })
        })
        
        
        
        if (uniqueVariantIds.size > 0) {
          const variantIdsArray = Array.from(uniqueVariantIds)
          const { products: fetchedProducts } = await fetchProductsWithBundles(variantIdsArray)
          
          setProducts(fetchedProducts)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        toast({
          title: 'Error fetching products',
          description: 'Failed to load product information',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingProducts(false)
        setIsInitialLoad(false)
      }
    }
    fetchAllProducts()
  }, [orders, toast, isInitialLoad])
  
  // Handle bulk travel time update
  const buildLabelKey = (orderNumber: number, labelIndex: number, productTitle: string) => {
    return `${orderNumber}|${labelIndex}|${String(productTitle || '').trim().toLowerCase()}`
  }

  const handleOpenPrintLabelsModal = async () => {
    if (!selectedDate) {
      toast({
        title: 'No date selected',
        description: 'Please select a date to print labels',
        variant: 'destructive',
      })
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const currentOrderIds = sortedOrders.map(o => o.id).join(',')

    setIsLoadingLabelCandidates(true)
    try {
      const params = new URLSearchParams()
      params.set('date', dateStr)
      if (currentOrderIds) params.set('orderIds', currentOrderIds)

      const res = await fetch(`/api/labels?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load labels')

      const json = await res.json()
      const mapped: LabelSelectionItem[] = (json.labels || []).map((label: any) => ({
        key: buildLabelKey(
          Number(label.orderNumber || 0),
          Number(label.labelIndex || 0),
          String(label.productTitle || '')
        ),
        orderNumber: Number(label.orderNumber || 0),
        productTitle: String(label.productTitle || 'Product'),
      }))

      if (mapped.length === 0) {
        toast({
          title: 'No labels found',
          description: 'No labels were found for the selected orders/date.',
        })
        return
      }

      setLabelCandidates(mapped)
      setSelectedLabelKeys(mapped.map((item) => item.key))
      setIsLabelModalOpen(true)
    } catch (error) {
      console.error('Error loading label candidates:', error)
      toast({
        title: 'Failed to load labels',
        description: error instanceof Error ? error.message : 'Could not load labels for selection.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingLabelCandidates(false)
    }
  }

  const handlePrintSelectedLabels = () => {
    if (!selectedDate) return
    if (selectedLabelKeys.length === 0) {
      toast({
        title: 'No labels selected',
        description: 'Select at least one label to print.',
        variant: 'destructive',
      })
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const currentOrderIds = sortedOrders.map(o => o.id).join(',')
    const url =
      `/labels/print?date=${encodeURIComponent(dateStr)}` +
      `&orderIds=${encodeURIComponent(currentOrderIds)}` +
      `&labelKeys=${encodeURIComponent(selectedLabelKeys.join(','))}`

    window.open(url, '_blank', 'noopener,noreferrer')
    setIsLabelModalOpen(false)
  }

  const toggleLabelSelection = (key: string, checked: boolean) => {
    setSelectedLabelKeys((prev) => {
      if (checked) return prev.includes(key) ? prev : [...prev, key]
      return prev.filter((value) => value !== key)
    })
  }

  const handleBulkTravelTimeUpdate = async () => {
    setIsUpdatingTravelTimes(true)
    try {
      // Filter out orders that already have a travel time or no delivery address
      const ordersToUpdate = sortedOrders.filter(order => 
        !order.travelTime && 
        order.shippingAddress?.address1
      )
      
      if (ordersToUpdate.length === 0) {
        toast({
          title: 'No updates needed',
          description: 'All orders already have travel times or are missing delivery addresses.',
        })
        setIsUpdatingTravelTimes(false)
        return
      }

      // console.log(`[BulkTravelTime] Updating travel times for ${ordersToUpdate.length} orders...`, ordersToUpdate.map(o => o.id)); // Commented out verbose log
      toast({
        title: 'Updating travel times...',
        description: `Fetching travel times for ${ordersToUpdate.length} orders.`,
      });
      // Prepare orders data for the API
      const ordersData = ordersToUpdate.map(order => ({
        id: order.id,
        deliveryAddress: order.shippingAddress?.address1 || '',
        hasManualTravelTime: false
      }))
      // Call the API to update travel times
      const response = await fetch('/api/maps/bulk-travel-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders: ordersData }),
      })
      if (!response.ok) {
        throw new Error('Failed to update travel times')
      }
      const data = await response.json()
      // console.log('[BulkTravelTime] API response:', data) // Commented out verbose log
      // Update each order with its new travel time
      let updatedCount = 0;
      for (const result of data.results) {
        try {
          await onUpdateOrder(result.orderId, { travelTime: result.durationInMinutes.toString() })
          updatedCount++;
        } catch (err) {
          console.error(`[BulkTravelTime] Error updating order ${result.orderId}:`, err)
        }
      }
      toast({
        title: 'Travel times updated',
        description: `Updated ${updatedCount} orders with new travel times.`,
      })
      // Trigger parent re-fetch if provided
      if (onBulkUpdateComplete) {
        onBulkUpdateComplete();
      }
    } catch (error) {
      console.error('[BulkTravelTime] Error updating travel times:', error)
      toast({
        title: 'Error updating travel times',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingTravelTimes(false)
    }
  }

  const compactListEnabled = (mobileSimpleList || forceCompactOnly) && !isTvMode
  const compactListClass = forceCompactOnly ? 'flex' : 'xl:hidden flex'
  const fullListClass = forceCompactOnly ? 'hidden' : compactListEnabled ? 'hidden xl:flex' : 'flex'

  const getOrderPhone = (order: Order) =>
    order.customerPhone || order.shippingLines?.find((s) => !!s.phone)?.phone || ''

  const getOrderAddress = (order: Order) => {
    const addrObj: any =
      typeof order.shippingAddress === 'string'
        ? (() => {
            try {
              return JSON.parse(order.shippingAddress)
            } catch {
              return {}
            }
          })()
        : (order.shippingAddress || {})

    const line1 = (addrObj?.address1 || '').toString().trim()
    const line2 = (addrObj?.address2 || '').toString().trim()
    const line3 = (addrObj?.address3 || '').toString().trim()
    const city = (addrObj?.city || '').toString().trim()
    return [line1, line2, line3, city].filter(Boolean).join(', ')
  }

  const getAddressForMaps = (order: Order) => {
    const addrObj: any =
      typeof order.shippingAddress === 'string'
        ? (() => {
            try {
              return JSON.parse(order.shippingAddress)
            } catch {
              return {}
            }
          })()
        : (order.shippingAddress || {})

    const parts = [
      (addrObj?.address1 || '').toString().trim(),
      (addrObj?.address2 || '').toString().trim(),
      (addrObj?.address3 || '').toString().trim(),
      (addrObj?.city || '').toString().trim(),
      (addrObj?.province || '').toString().trim(),
      (addrObj?.zip || '').toString().trim(),
    ].filter(Boolean)
    return parts.join(', ')
  }

  const getOrderCompany = (order: Order) => {
    const addrObj: any =
      typeof order.shippingAddress === 'string'
        ? (() => {
            try {
              return JSON.parse(order.shippingAddress)
            } catch {
              return {}
            }
          })()
        : (order.shippingAddress || {})
    return (addrObj?.company || '').toString().trim()
  }

  const getCompactOrderItems = (order: Order) => {
    let base: any[] = []
    if (Array.isArray(order.lineItems)) {
      base = order.lineItems
    } else if (typeof order.lineItems === 'string' && order.lineItems) {
      try {
        base = JSON.parse(order.lineItems)
      } catch {
        base = []
      }
    }

    return base.map((it: any, idx: number) => {
      const variantId = it.variant_id?.toString() || it.variantId?.toString()
      const product = variantId ? (products as any)[variantId] : null
      const name = (() => {
        if (product?.displayName?.trim()) return product.displayName
        const shopifyName = product?.shopifyName
        if (shopifyName && shopifyName !== 'Default Title') return shopifyName
        return product?.shopifyTitle || product?.name || it.title || 'Item'
      })()
      const qty = Number(it.quantity || 1)
      const hasSW =
        !!product?.serveware ||
        ((it.variant_title || it.variantTitle || '').toLowerCase().includes('yes serveware'))

      return {
        key: `${variantId || it.id || idx}-${idx}`,
        qty,
        name,
        hasSW,
      }
    })
  }

  const getItemCount = (order: Order) => {
    if (Array.isArray(order.lineItems)) return order.lineItems.reduce((sum, item: any) => sum + Number(item.quantity || 0), 0)
    if (typeof order.lineItems === 'string') {
      try {
        const parsed = JSON.parse(order.lineItems)
        if (Array.isArray(parsed)) return parsed.reduce((sum, item: any) => sum + Number(item.quantity || 0), 0)
      } catch {}
    }
    return 0
  }

  return (
    <div className={`w-full space-y-2 ${compactFonts ? 'text-xs xl:text-sm' : ''}`}>
      <div className={`flex gap-2 ${compactListEnabled ? 'flex-col xl:flex-row xl:items-center xl:justify-between' : 'justify-between items-center'}`}>
        <div className={`flex gap-2 ${compactListEnabled ? 'overflow-x-auto pb-1 whitespace-nowrap' : ''}`}>
          <button
            onClick={() => setFilter('undispatched')}
            className={`px-3 py-1 rounded ${
              filter === 'undispatched' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Undispatched
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unfulfilled')}
            className={`px-3 py-1 rounded ${
              filter === 'unfulfilled' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Unfulfilled
          </button>
          <button
            onClick={() => setFilter('fulfilled')}
            className={`px-3 py-1 rounded ${
              filter === 'fulfilled' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Fulfilled
          </button>
          <button
            onClick={handleOpenPrintLabelsModal}
            disabled={isLoadingLabelCandidates}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 flex items-center gap-1"
            title="Print labels for this date"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
        
        <div className={`items-center gap-4 ${compactListEnabled ? 'hidden xl:flex' : 'flex'}`}>
          {/* Oven Count Display - Simplified */}
          {realTimeOvenCountString && (
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <span className="font-bold text-lg">{realTimeOvenCountString}</span>
            </div>
          )}
          
          {/* Audio Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className="flex items-center gap-2"
            title={isAudioEnabled ? "Disable timer alerts" : "Enable timer alerts"}
          >
            {isAudioEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          
          <Button 
            onClick={handleBulkTravelTimeUpdate} 
            disabled={isUpdatingTravelTimes}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isUpdatingTravelTimes ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Travel Times'
            )}
          </Button>

          {/* Runsheet Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRunsheetOpen(true)}
            className="flex items-center gap-2"
            title="Open Runsheet"
          >
            <ListChecks className="h-4 w-4" />
            Runsheet
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsTextModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            title="Text all clients"
          >
            Text all
          </Button>
        </div>
      </div>

      {sortedOrders.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No orders found</p>
      ) : (
        <>
          {compactListEnabled && (
            <div className={`${compactListClass} flex-col space-y-2 w-full`}>
              {sortedOrders.map((order) => (
                (() => {
                  const company = getOrderCompany(order)
                  const compactItems = getCompactOrderItems(order)
                  return (
                    <div
                      key={order.id}
                      className={`rounded-lg border bg-white p-3 ${
                        recentlyDispatchedOrders.has(order.id) ? 'border-green-500 bg-green-50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-sm">{order.leaveTime || order.deliveryTime || '--:--'}</span>
                          <span className="text-xs text-slate-500 truncate">#{order.orderNumber}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          order.isDispatched ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.isDispatched ? 'Dispatched' : 'Pending'}
                        </span>
                      </div>

                      <div className="mt-2">
                        <p className="font-medium text-base leading-tight truncate">
                          {`${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Unknown customer'}
                          {company ? ` - ${company}` : ''}
                        </p>
                        <p className="text-xs text-slate-600 truncate">{getOrderPhone(order) || 'No phone'}</p>
                        <div className="flex items-center min-w-0">
                          <p className="text-xs text-slate-600 truncate">{getOrderAddress(order) || 'No address'}</p>
                          <DeliveryNotesButton
                            orderId={order.id}
                            shippingAddress={order.shippingAddress}
                            customerEmail={order.customerEmail}
                            addressLabel={getOrderAddress(order)}
                            notes={deliveryNotesByOrderId[order.id]}
                            onNotesChanged={updateDeliveryNotes}
                            className="ml-1.5"
                            iconClassName="h-3.5 w-3.5"
                          />
                        </div>
                        {order.note ? <p className="text-xs text-slate-700 mt-1 truncate">{order.note}</p> : null}
                        {order.customerNote ? (
                          <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Customer note</div>
                            <p className="whitespace-pre-wrap text-xs text-amber-900">{order.customerNote}</p>
                          </div>
                        ) : null}
                        {order.internalNote ? (
                          <div className="mt-1.5 rounded-md border border-blue-200 bg-blue-50 p-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Internal note</div>
                            <p className="whitespace-pre-wrap text-xs text-blue-800">{order.internalNote}</p>
                          </div>
                        ) : null}
                      </div>

                      {compactItems.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {compactItems.map((it) => (
                            <div key={it.key} className="flex items-center justify-between text-xs text-slate-700">
                              <div className="flex items-center min-w-0">
                                <span className="w-7 flex-shrink-0 text-[10px] font-black text-red-600">{it.hasSW ? 'SW' : ''}</span>
                                <span className="truncate">{it.name}</span>
                              </div>
                              <span className="ml-2 text-slate-500">x{it.qty}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <PaymentAlertBadge order={order} className="shrink-0" />
                          {getItemCount(order)} items {order.travelTime ? `• ${order.travelTime} min` : ''}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                            onClick={() => {
                              const phone = getOrderPhone(order)
                              if (!phone) {
                                alert('No phone number available')
                                return
                              }
                              const shouldCall = window.confirm(`Do you want to call ${phone}?`)
                              if (!shouldCall) return
                              window.location.href = `tel:${phone}`
                            }}
                          >
                            Call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                            onClick={() => {
                              const phone = getOrderPhone(order)
                              if (!phone) {
                                alert('No phone number available')
                                return
                              }
                              window.location.href = `sms:${phone}`
                            }}
                          >
                            Txt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                            onClick={() => {
                              const addr = getAddressForMaps(order)
                              if (!addr) {
                                alert('No address available')
                                return
                              }
                              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                              window.open(url, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            Map
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()
              ))}
            </div>
          )}

          <div className={`${fullListClass} flex-col space-y-2 w-full order-cards-container`}>
            {sortedOrders.map((order) => (
              <div 
                key={order.id} 
                className={`transition-all duration-1000 ${
                  recentlyDispatchedOrders.has(order.id) 
                    ? 'opacity-50 scale-95 bg-green-50 border-l-4 border-green-500' 
                    : ''
                }`}
              >
            <OrderCard 
                  order={order} 
                  onUpdate={memoizedOnUpdateOrder}
                  products={products}
                  refreshProducts={refreshProducts}
                  onBulkUpdateComplete={refreshAllData}
                  updateProductInState={updateProductInState}
                  isAudioEnabled={isAudioEnabled}
                  originAddressOverride={originAddressOverride}
              isTvMode={isTvMode}
                  compactFonts={compactFonts}
                  deliveryNotes={deliveryNotesByOrderId[order.id]}
                  onDeliveryNotesChanged={updateDeliveryNotes}
                />
              </div>
            ))}
          </div>
        </>
      )}
      <RunsheetModal isOpen={isRunsheetOpen} onClose={() => setIsRunsheetOpen(false)} date={selectedDate || new Date()} orders={sortedOrders} productsMap={products} isWLG={!!originAddressOverride && originAddressOverride.includes('Wellington')} />
      <TextOrdersModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        orders={sortedOrders}
        defaultTemplate="delivery"
        presetSelection={sortedOrders.map(o => o.id)}
      />
      <Dialog open={isLabelModalOpen} onOpenChange={setIsLabelModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select labels to print</DialogTitle>
            <DialogDescription>
              All labels are pre-selected. Uncheck any labels you do not want to print.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto rounded border">
            <div className="divide-y">
              {labelCandidates.map((item) => {
                const checked = selectedLabelKeys.includes(item.key)
                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleLabelSelection(item.key, value === true)}
                    />
                    <span className="font-medium text-slate-700">#{item.orderNumber}</span>
                    <span className="truncate text-slate-600">{item.productTitle}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedLabelKeys([])}
              disabled={selectedLabelKeys.length === 0}
            >
              Unselect all
            </Button>
            <Button
              type="button"
              onClick={handlePrintSelectedLabels}
              disabled={selectedLabelKeys.length === 0}
            >
              Print selected ({selectedLabelKeys.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 