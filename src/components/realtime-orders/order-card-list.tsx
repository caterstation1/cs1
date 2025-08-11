'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Order } from '@/types/order'
import OrderCard from './order-card'
import { Button } from '@/components/ui/button'
import { Loader2, Volume2, VolumeX, Printer } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { fetchProducts, clearProductCache } from '@/lib/product-service'
import { format } from 'date-fns'

interface OrderCardListProps {
  orders: Order[]
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => Promise<Order>
  onBulkUpdateComplete?: () => void // Optional callback for parent to re-fetch orders
  selectedDate?: Date // Date for printing labels
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

export default function OrderCardList({ orders, onUpdateOrder, onBulkUpdateComplete, selectedDate }: OrderCardListProps) {
  const [filter, setFilter] = useState<'all' | 'undispatched' | 'unfulfilled' | 'fulfilled'>('undispatched')
  const [isUpdatingTravelTimes, setIsUpdatingTravelTimes] = useState(false)
  const [products, setProducts] = useState<Record<string, any>>({})
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [recentlyDispatchedOrders, setRecentlyDispatchedOrders] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  
  // Audio state
  const { isAudioEnabled, setIsAudioEnabled } = useAudioState()

  // Function to refresh products data
  const refreshProducts = async () => {
    setIsLoadingProducts(true)
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
        const fetchedProducts = await fetchProducts(variantIdsArray)
        setProducts(fetchedProducts)
        
        // Show a toast to confirm products were refreshed
        toast({
          title: 'Products refreshed',
          description: `Updated product data for ${Object.keys(fetchedProducts).length} products`,
        })
      }
    } catch (error) {
      console.error('Error refreshing products:', error)
      toast({
        title: 'Error refreshing products',
        description: 'Failed to refresh product information',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingProducts(false)
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
      console.log('🕐 Oven count update at:', newTime.toLocaleTimeString());
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
    console.log('🔥 Oven count recalculated:', count);
    return count;
  }, [orders, products, currentTime]);

  const realTimeOvenCountString = Object.entries(realTimeOvenCount)
    .map(([meat, count]) => `${meat}${count}`)
    .join(' ');

  // Memoize the onUpdateOrder function to prevent unnecessary re-renders
  const memoizedOnUpdateOrder = useMemo(() => {
    return async (orderId: string, updates: Partial<Order>): Promise<Order> => {
      // console.log('OrderCardList onUpdateOrder called:', orderId, updates); // Commented out verbose log
      try {
        const result = await onUpdateOrder(orderId, updates);
        
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
        console.error('Error updating order:', error);
        toast({
          title: 'Error updating order',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
          variant: 'destructive',
        });
        throw error;
      }
    };
  }, [onUpdateOrder, toast]);

  // Memoize the filtered and sorted orders to prevent unnecessary re-renders
  const { filteredOrders, sortedOrders } = useMemo(() => {
    // Filter orders based on fulfillment status and dispatch status
    const filtered = orders.filter(order => {
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
  }, [orders, filter, recentlyDispatchedOrders]);

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
            console.log('Debug line item:', {
              item,
              variant_id: item.variant_id,
              variantId: item.variantId,
              sku: item.sku,
              title: item.title
            });
            
            // Try multiple possible field names for variant ID
            const variantId = item.variant_id || item.variantId || item.variantid;
            if (variantId) {
              // Shopify API may use variant_id (number), so convert to string
              const variantIdString = variantId.toString();
              uniqueVariantIds.add(variantIdString);
              console.log('Added variant ID:', variantIdString);
            } else {
              console.warn('No variant ID found for item:', item);
            }
          })
        })
        
        console.log('Debug OrderCardList:', {
          totalOrders: orders.length,
          uniqueVariantIds: Array.from(uniqueVariantIds).slice(0, 10), // Show first 10
          uniqueVariantIdsCount: uniqueVariantIds.size
        })
        
        if (uniqueVariantIds.size > 0) {
          const variantIdsArray = Array.from(uniqueVariantIds)
          const fetchedProducts = await fetchProducts(variantIdsArray)
          console.log('Debug fetched products:', {
            requestedCount: variantIdsArray.length,
            fetchedCount: Object.keys(fetchedProducts).length,
            fetchedKeys: Object.keys(fetchedProducts).slice(0, 5) // Show first 5
          })
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
  // Print labels function - use the existing print page with proper LabelCard rendering
  const handlePrintLabels = async () => {
    if (!selectedDate) {
      toast({
        title: 'No date selected',
        description: 'Please select a date to print labels',
        variant: 'destructive',
      })
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    try {
      // Use the existing print page which has proper LabelCard rendering
      const url = `/labels/print?date=${encodeURIComponent(dateStr)}`
      
      // Create a hidden iframe to load the print page
      const iframe = document.createElement('iframe')
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.style.position = 'fixed'
      iframe.style.left = '-9999px'
      document.body.appendChild(iframe)
      
      // Load the print page in the iframe
      iframe.src = url
      
      // Wait for the page to load and then trigger print
      iframe.onload = () => {
        setTimeout(() => {
          try {
            // Try to trigger print in the iframe
            iframe.contentWindow?.print()
          } catch (error) {
            console.error('Failed to print in iframe:', error)
            // Fallback: open in new tab
            window.open(url, '_blank')
          }
          
          // Clean up the iframe after a delay
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe)
            }
          }, 5000) // Give enough time for print dialog
        }, 1000) // Wait for the page to fully load
      }
      
    } catch (error) {
      console.error('Print error:', error)
      toast({
        title: 'Print failed',
        description: 'Failed to print labels: ' + (error as Error).message,
        variant: 'destructive',
      })
    }
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

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
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
            onClick={handlePrintLabels}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 flex items-center gap-1"
            title="Print labels for this date"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
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
        </div>
      </div>

      {isLoadingProducts && isInitialLoad ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : sortedOrders.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No orders found</p>
      ) : (
        <div className="flex flex-col space-y-2 w-full">
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
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 