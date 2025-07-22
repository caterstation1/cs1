'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GilmoursTab } from "./GilmoursTab"
import { BidfoodTab } from "./BidfoodTab"
import { OtherTab } from "./OtherTab"
import { ComponentsTab } from "./ComponentsTab"
import { ProductsTab } from "./ProductsTab"
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
          const shopifyResponse = await fetch('/api/shopify/products')
          console.log('Shopify response status:', shopifyResponse.status)
          console.log('Shopify response ok:', shopifyResponse.ok)
          
          if (!shopifyResponse.ok) {
            const errorData = await shopifyResponse.json()
            console.error('Shopify response error:', errorData)
            throw new Error(errorData.error || 'Failed to fetch Shopify products')
        }
          
          const shopifyData = await shopifyResponse.json()
          console.log('Shopify data received:', shopifyData.variants?.length || 0, 'variants')
          console.log('Setting shopifyProducts to:', shopifyData.variants || [])
          setShopifyProducts(shopifyData.variants || [])
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
          console.log('Gilmours data received:', gilmoursData.length || 0, 'products')
        setGilmoursProducts(gilmoursData)
      } catch (error) {
        console.error('Error fetching Gilmours products:', error)
        setGilmoursError(error instanceof Error ? error.message : 'Failed to fetch Gilmours products')
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
          console.log('Bidfood data received:', bidfoodData.length || 0, 'products')
        setBidfoodProducts(bidfoodData)
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
          console.log('Other data received:', otherData.length || 0, 'products')
        setOtherProducts(otherData)
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
          console.log('Components data received:', componentsData.length || 0, 'components')
        setComponents(componentsData)
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
      <Tabs defaultValue="products" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="gilmours">Gilmours</TabsTrigger>
          <TabsTrigger value="bidfood">Bidfood</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab />
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
      </Tabs>
    </div>
  )
} 