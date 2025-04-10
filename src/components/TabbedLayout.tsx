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
import { Product } from '@/components/ProductsTab'
import { SuppliersTab } from "./SuppliersTab"

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
  const [products, setProducts] = useState<Product[]>([])
  const [gilmoursProducts, setGilmoursProducts] = useState<GilmoursProduct[]>([])
  const [bidfoodProducts, setBidfoodProducts] = useState<BidfoodProduct[]>([])
  const [otherProducts, setOtherProducts] = useState<OtherProduct[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [gilmoursError, setGilmoursError] = useState<string | null>(null)
  const [bidfoodError, setBidfoodError] = useState<string | null>(null)
  const [otherError, setOtherError] = useState<string | null>(null)
  const [componentsError, setComponentsError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setProductsError(null)
      setGilmoursError(null)
      setBidfoodError(null)
      setOtherError(null)
      setComponentsError(null)

      try {
        // Fetch Products
        const productsResponse = await fetch('/api/products')
        if (!productsResponse.ok) {
          const errorData = await productsResponse.json()
          throw new Error(errorData.error || 'Failed to fetch products')
        }
        const productsData = await productsResponse.json()
        setProducts(productsData)
      } catch (error) {
        console.error('Error fetching products:', error)
        setProductsError(error instanceof Error ? error.message : 'Failed to fetch products')
      }

      try {
        // Fetch Gilmours products
        const gilmoursResponse = await fetch('/api/gilmours')
        if (!gilmoursResponse.ok) {
          const errorData = await gilmoursResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Gilmours products')
        }
        const gilmoursData = await gilmoursResponse.json()
        setGilmoursProducts(gilmoursData)
      } catch (error) {
        console.error('Error fetching Gilmours products:', error)
        setGilmoursError(error instanceof Error ? error.message : 'Failed to fetch Gilmours products')
      }

      try {
        // Fetch Bidfood products
        const bidfoodResponse = await fetch('/api/bidfood')
        if (!bidfoodResponse.ok) {
          const errorData = await bidfoodResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Bidfood products')
        }
        const bidfoodData = await bidfoodResponse.json()
        setBidfoodProducts(bidfoodData)
      } catch (error) {
        console.error('Error fetching Bidfood products:', error)
        setBidfoodError(error instanceof Error ? error.message : 'Failed to fetch Bidfood products')
      }

      try {
        // Fetch Other products
        const otherResponse = await fetch('/api/other')
        if (!otherResponse.ok) {
          const errorData = await otherResponse.json()
          throw new Error(errorData.error || 'Failed to fetch Other products')
        }
        const otherData = await otherResponse.json()
        setOtherProducts(otherData)
      } catch (error) {
        console.error('Error fetching Other products:', error)
        setOtherError(error instanceof Error ? error.message : 'Failed to fetch Other products')
      }

      try {
        // Fetch Components
        const componentsResponse = await fetch('/api/components')
        if (!componentsResponse.ok) {
          const errorData = await componentsResponse.json()
          throw new Error(errorData.error || 'Failed to fetch components')
        }
        const componentsData = await componentsResponse.json()
        setComponents(componentsData)
      } catch (error) {
        console.error('Error fetching components:', error)
        setComponentsError(error instanceof Error ? error.message : 'Failed to fetch components')
      }

      setIsLoading(false)
    }

    fetchData()
  }, [])

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
          <ProductsTab 
            products={products}
            setProducts={setProducts}
            isLoading={isLoading}
            error={productsError}
          />
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