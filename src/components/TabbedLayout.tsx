'use client'

import { useState, useEffect, startTransition } from 'react'
import { AskAIButton } from '@/components/ai/AskAI'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GilmoursTab } from "./GilmoursTab"
import { BidfoodTab } from "./BidfoodTab"
import { OtherTab } from "./OtherTab"
import { ComponentsTab } from "./ComponentsTab"
import { ProductsTab } from "./ProductsTab"
import { VariantsTab } from "./VariantsTab"
import { OverviewTab } from "./products/OverviewTab"
import { GilmoursProduct } from "@/lib/types"
import { BidfoodProduct } from '@/components/BidfoodTab'
import { OtherProduct } from '@/components/OtherTab'
import { Component } from '@/components/ComponentsTab'
import { SuppliersTab } from "./SuppliersTab"

// New Shopify product type
interface ShopifyProduct {
  product_id: string;
  product_title: string;
  handle: string;
  variant_id: string;
  variant_title: string;
  sku: string | null;
  price: number;
  inventoryQuantity: number;
  shopify_title: string;
  shopify_variant_title: string;
  shopify_sku: string | null;
  shopify_price: number;
  shopify_inventory: number;
  meat1: string | null;
  meat2: string | null;
  option1: string | null;
  option2: string | null;
  serveware: string | null;
  timerA: number | null;
  timerB: number | null;
  ingredients: any | null;
  totalCost: number;
  hasCustomData: boolean;
  customDataId: string | null;
}

const tabs = [
  { id: 'products', label: 'Products' },
  { id: 'variants', label: 'Variants' },
  { id: 'components', label: 'Components' },
  { id: 'gilmours', label: 'Gilmours' },
  { id: 'bidfood', label: 'Bidfood' },
  { id: 'other', label: 'Other' },
  { id: 'suppliers', label: 'Suppliers' },
]

export function TabbedLayout() {
  const [activeTab, setActiveTab] = useState('products')
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([])
  const [gilmoursProducts, setGilmoursProducts] = useState<GilmoursProduct[]>([])
  const [bidfoodProducts, setBidfoodProducts] = useState<BidfoodProduct[]>([])
  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shopifyError, setShopifyError] = useState<string | null>(null)
  const [gilmoursError, setGilmoursError] = useState<string | null>(null)
  const [bidfoodError, setBidfoodError] = useState<string | null>(null)
  const [otherError, setOtherError] = useState<string | null>(null)
  const [componentsError, setComponentsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Starting to fetch data...')
        setIsLoading(true)
        setShopifyError(null)
        setGilmoursError(null)
        setBidfoodError(null)
        setOtherError(null)
        setComponentsError(null)

      try {
          // Fetch Shopify Products
          console.log('Fetching Shopify products...')
          const shopifyResponse = await fetch('/api/products')
          console.log('Shopify response status:', shopifyResponse.status)
          console.log('Shopify response ok:', shopifyResponse.ok)
          const shopifyContentType = shopifyResponse.headers.get('content-type');
          if (shopifyResponse.ok && shopifyContentType && shopifyContentType.includes('application/json')) {
            const shopifyData = await shopifyResponse.json();
            console.log('Shopify data received:', shopifyData?.variants?.length || 0, 'variants')
            console.log('Setting shopifyProducts to:', shopifyData?.variants || [])
            setShopifyProducts(Array.isArray(shopifyData?.variants) ? shopifyData.variants : [])
          } else {
            const text = await shopifyResponse.text();
            console.error('Shopify response error:', text);
            setShopifyError(text || 'Failed to fetch Shopify products');
          }
      } catch (error) {
          console.error('Error fetching Shopify products:', error)
          setShopifyError(error instanceof Error ? error.message : 'Failed to fetch Shopify products')
      }

      try {
        // Fetch Gilmours products
          console.log('Fetching Gilmours products...')
        const gilmoursResponse = await fetch('/api/gilmours')
        if (!gilmoursResponse.ok) {
          const errorData = await gilmoursResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Gilmours products')
        }
        const gilmoursData = await gilmoursResponse.json()
          console.log('Gilmours data received:', gilmoursData?.products?.length || 0, 'products')
        // Ensure we always set an array, and validate the data structure
        const products = Array.isArray(gilmoursData?.products) ? gilmoursData.products : []
        // Validate and sanitize each product to ensure it's safe for React state
        // Create completely new plain objects with ONLY the fields we need
        // Exclude Prisma metadata fields (id, createdAt, updatedAt) that might cause issues
        const validProducts: GilmoursProduct[] = products
          .filter((p: any) => p && typeof p === 'object' && p.sku)
          .map((p: any) => {
            try {
              // Create a new object with ONLY the fields from GilmoursProduct interface
              // This ensures no Prisma metadata or extra fields are included
              const cleanProduct: GilmoursProduct = {
                sku: String(p.sku || ''),
                brand: String(p.brand || ''),
                description: String(p.description || ''),
                packSize: String(p.packSize || ''),
                uom: String(p.uom || ''),
                price: typeof p.price === 'number' && isFinite(p.price) ? p.price : (typeof p.price === 'string' ? parseFloat(p.price) || 0 : 0),
                quantity: typeof p.quantity === 'number' && isFinite(p.quantity) ? p.quantity : (typeof p.quantity === 'string' ? parseInt(p.quantity, 10) || 0 : 0),
              }
              // Verify the object is serializable (no circular refs, no functions, etc.)
              JSON.stringify(cleanProduct)
              return cleanProduct
            } catch (e) {
              console.warn('Error sanitizing Gilmours product:', e, p)
              return null
            }
          })
          .filter((p: GilmoursProduct | null): p is GilmoursProduct => p !== null)
        // Use startTransition and setTimeout to defer state update and prevent blocking render
        // This prevents React from trying to process the state update during async operations
        startTransition(() => {
          // Use setTimeout to ensure this happens after the current render cycle
          setTimeout(() => {
            setGilmoursProducts(validProducts)
          }, 0)
        })
      } catch (error) {
        console.error('Error fetching Gilmours products:', error)
        setGilmoursError(error instanceof Error ? error.message : 'Failed to fetch Gilmours products')
        setGilmoursProducts([]) // Ensure we always have an array even on error
      }

      try {
        // Fetch Bidfood products
          console.log('Fetching Bidfood products...')
        const bidfoodResponse = await fetch('/api/bidfood')
        if (!bidfoodResponse.ok) {
          const errorData = await bidfoodResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Bidfood products')
        }
        const bidfoodData = await bidfoodResponse.json()
          console.log('Bidfood data received:', bidfoodData?.products?.length || 0, 'products')
        // Sanitize bidfood products
        const bidfoodArray = Array.isArray(bidfoodData?.products) ? bidfoodData.products : []
        const sanitizedBidfood = bidfoodArray
          .filter((p: any) => p && typeof p === 'object' && p.productCode)
          .map((p: any) => {
            try {
              const clean = {
                id: String(p.id || ''),
                productCode: String(p.productCode || ''),
                brand: String(p.brand || ''),
                description: String(p.description || ''),
                packSize: String(p.packSize || ''),
                ctnQty: String(p.ctnQty || ''),
                uom: String(p.uom || ''),
                qty: typeof p.qty === 'number' && isFinite(p.qty) ? p.qty : 0,
                lastPricePaid: typeof p.lastPricePaid === 'number' && isFinite(p.lastPricePaid) ? p.lastPricePaid : 0,
                totalExGST: typeof p.totalExGST === 'number' && isFinite(p.totalExGST) ? p.totalExGST : 0,
                contains: String(p.contains || ''),
              } as BidfoodProduct
              JSON.stringify(clean)
              return clean
            } catch (e) {
              console.warn('Error sanitizing Bidfood product:', e, p)
              return null
            }
          })
          .filter((p: BidfoodProduct | null): p is BidfoodProduct => p !== null)
        startTransition(() => {
          setTimeout(() => {
            setBidfoodProducts(sanitizedBidfood)
          }, 0)
        })
      } catch (error) {
        console.error('Error fetching Bidfood products:', error)
        setBidfoodError(error instanceof Error ? error.message : 'Failed to fetch Bidfood products')
      }

      try {
        // Fetch Other products
          console.log('Fetching Other products...')
        const otherResponse = await fetch('/api/other')
        if (!otherResponse.ok) {
          const errorData = await otherResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Other products')
        }
        const otherData = await otherResponse.json()
          console.log('Other data received:', otherData?.products?.length || 0, 'products')
        // Sanitize other products
        const otherArray = Array.isArray(otherData?.products) ? otherData.products : []
        const sanitizedOther = otherArray
          .filter((p: any) => p && typeof p === 'object' && p.name)
          .map((p: any) => {
            try {
              const clean: OtherProduct = {
                id: String(p.id || ''),
                name: String(p.name || ''),
                supplier: String(p.supplier || ''),
                description: String(p.description || ''),
                cost: typeof p.cost === 'number' && isFinite(p.cost) ? p.cost : 0,
                prepCategory: p.prepCategory ? String(p.prepCategory) : undefined,
                createdAt: String(p.createdAt || ''),
                updatedAt: String(p.updatedAt || ''),
              }
              JSON.stringify(clean)
              return clean
            } catch (e) {
              console.warn('Error sanitizing Other product:', e, p)
              return null
            }
          })
          .filter((p: OtherProduct | null): p is OtherProduct => p !== null)
        startTransition(() => {
          setTimeout(() => {
            setOtherProducts(sanitizedOther)
          }, 0)
        })
      } catch (error) {
        console.error('Error fetching Other products:', error)
        setOtherError(error instanceof Error ? error.message : 'Failed to fetch Other products')
      }

      try {
        // Fetch Components
          console.log('Fetching Components...')
        const componentsResponse = await fetch('/api/components')
        if (!componentsResponse.ok) {
          const errorData = await componentsResponse.json()
          throw new Error(errorData.error || 'Failed to fetch components')
        }
        const componentsData = await componentsResponse.json()
          console.log('Components data received:', componentsData?.length || 0, 'components')
        // Sanitize components data to ensure it's safe for React state
        const componentsArray = Array.isArray(componentsData) ? componentsData : []
        const sanitizedComponents: Component[] = componentsArray
          .filter((c: any) => c && typeof c === 'object' && c.id)
          .map((c: any) => {
            try {
              // Create clean object with only required fields
              const cleanComponent: Component = {
                id: String(c.id || ''),
                name: String(c.name || ''),
                description: String(c.description || ''),
                ingredients: Array.isArray(c.ingredients) ? c.ingredients.map((ing: any) => ({
                  source: String(ing.source || ''),
                  id: String(ing.id || ''),
                  name: String(ing.name || ''),
                  quantity: typeof ing.quantity === 'number' && isFinite(ing.quantity) ? ing.quantity : 0,
                  cost: typeof ing.cost === 'number' && isFinite(ing.cost) ? ing.cost : 0,
                  unit: String(ing.unit || ''),
                })) : [],
                totalCost: typeof c.totalCost === 'number' && isFinite(c.totalCost) ? c.totalCost : 0,
                producedQuantity: typeof c.producedQuantity === 'number' && isFinite(c.producedQuantity) ? c.producedQuantity : undefined,
                producedUnit: c.producedUnit ? String(c.producedUnit) : undefined,
                rawWeight: typeof c.rawWeight === 'number' && isFinite(c.rawWeight) ? c.rawWeight : (c.rawWeight === null ? null : undefined),
                cookedWeight: typeof c.cookedWeight === 'number' && isFinite(c.cookedWeight) ? c.cookedWeight : (c.cookedWeight === null ? null : undefined),
                trimWasteWeight: typeof c.trimWasteWeight === 'number' && isFinite(c.trimWasteWeight) ? c.trimWasteWeight : (c.trimWasteWeight === null ? null : undefined),
                weightUnit: c.weightUnit ? String(c.weightUnit) : null,
                costPerOutputUnit: typeof c.costPerOutputUnit === 'number' && isFinite(c.costPerOutputUnit) ? c.costPerOutputUnit : undefined,
                normalizedOutputUnit: c.normalizedOutputUnit ? String(c.normalizedOutputUnit) : undefined,
                hasGluten: Boolean(c.hasGluten),
                hasDairy: Boolean(c.hasDairy),
                hasSoy: Boolean(c.hasSoy),
                hasOnionGarlic: Boolean(c.hasOnionGarlic),
                hasSesame: Boolean(c.hasSesame),
                hasNuts: Boolean(c.hasNuts),
                hasEgg: Boolean(c.hasEgg),
                isVegetarian: Boolean(c.isVegetarian),
                isVegan: Boolean(c.isVegan),
                isHalal: Boolean(c.isHalal),
                isComponentListItem: Boolean(c.isComponentListItem),
                createdAt: String(c.createdAt || ''),
                updatedAt: String(c.updatedAt || ''),
                images: Array.isArray(c.images) ? c.images.map((img: any) => ({
                  id: String(img.id || ''),
                  publicId: String(img.publicId || ''),
                  url: String(img.url || ''),
                  alt: img.alt ? String(img.alt) : null,
                  position: typeof img.position === 'number' && isFinite(img.position) ? img.position : 0,
                })) : undefined,
              }
              // Verify serializability
              JSON.stringify(cleanComponent)
              return cleanComponent
            } catch (e) {
              console.warn('Error sanitizing Component:', e, c)
              return null
            }
          })
          .filter((c: Component | null): c is Component => c !== null)
        // Use startTransition to defer state update
        startTransition(() => {
          setTimeout(() => {
            setComponents(sanitizedComponents)
          }, 0)
        })
      } catch (error) {
        console.error('Error fetching components:', error)
        setComponentsError(error instanceof Error ? error.message : 'Failed to fetch components')
      }

        console.log('Setting loading to false...')
        setIsLoading(false)
      } catch (error) {
        console.error('Unexpected error in fetchData:', error)
      setIsLoading(false)
      }
    }

    fetchData().catch((error) => {
      console.error('Unexpected error in fetchData:', error)
      setIsLoading(false)
    })
  }, [])

  // Add a fallback to ensure loading is set to false after a timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Loading timeout reached, forcing loading to false')
        setIsLoading(false)
      }
    }, 5000) // 5 second timeout

    return () => clearTimeout(timeout)
  }, [isLoading])

  // Monitor shopifyProducts state
  useEffect(() => {
    console.log('shopifyProducts state changed:', shopifyProducts.length, 'products')
  }, [shopifyProducts])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <AskAIButton />
      </div>
      <Tabs defaultValue="products" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="gilmours">Gilmours</TabsTrigger>
          <TabsTrigger value="bidfood">Bidfood</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="variants">
          <VariantsTab />
        </TabsContent>
        <TabsContent value="components">
          <ComponentsTab 
            components={components}
            setComponents={setComponents}
            isLoading={isLoading}
            error={componentsError}
          />
        </TabsContent>
        <TabsContent value="gilmours">
          <GilmoursTab 
            products={gilmoursProducts} 
            setProducts={setGilmoursProducts} 
            isLoading={isLoading}
            error={gilmoursError}
          />
        </TabsContent>
        <TabsContent value="bidfood">
          <BidfoodTab 
            products={bidfoodProducts} 
            setProducts={setBidfoodProducts} 
            isLoading={isLoading}
            error={bidfoodError}
          />
        </TabsContent>
        <TabsContent value="other">
          <OtherTab 
            products={otherProducts} 
            setProducts={setOtherProducts} 
            isLoading={isLoading}
            error={otherError}
          />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
      </Tabs>
    </div>
  )
} 
