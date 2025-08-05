'use client'

import { useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { GilmoursProduct, GilmoursProductMap } from "@/lib/types"
import { Dispatch, SetStateAction } from 'react'

interface GilmoursTabProps {
  products: GilmoursProduct[]
  setProducts: Dispatch<SetStateAction<GilmoursProduct[]>>
  isLoading: boolean
  error: string | null
}

export function GilmoursTab({ products, setProducts, isLoading, error }: GilmoursTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [debugData, setDebugData] = useState<any>(null)
  
  // Debug logging
  console.log('GilmoursTab render - products:', products, 'type:', typeof products, 'isArray:', Array.isArray(products))

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const rows = text.split('\n').map(row => row.split(','))
    const headers = rows[0].map(header => header.toLowerCase().trim())
    
    console.log('🔍 CSV Debug - Headers:', headers)
    
    // Find column indices
    const skuIndex = headers.findIndex(h => h.includes('sku'))
    const brandIndex = headers.findIndex(h => h.includes('brand'))
    const descIndex = headers.findIndex(h => h.includes('description') || h.includes('desc'))
    const packIndex = headers.findIndex(h => h.includes('pack') && h.includes('size'))
    const uomIndex = headers.findIndex(h => h.includes('uom') || h.includes('unit'))
    const priceIndex = headers.findIndex(h => h.includes('price'))
    const qtyIndex = headers.findIndex(h => h.includes('qty') || h.includes('quantity'))
    
    console.log('🔍 CSV Debug - Column Indices:', {
      skuIndex,
      brandIndex,
      descIndex,
      packIndex,
      uomIndex,
      priceIndex,
      qtyIndex
    })
    
    // Show first few rows for debugging
    console.log('🔍 CSV Debug - First 3 rows:', rows.slice(0, 3))

    // Helper function to clean field values
    const cleanField = (value: string | undefined): string => {
      if (!value) return ''
      return value.replace(/^["']|["']$/g, '').trim()
    }

    // Helper function to parse numbers safely
    const parseNumber = (value: string | undefined, isInteger = false): number => {
      if (!value) return 0
      const cleaned = cleanField(value)
      if (!cleaned) return 0
      
      console.log(`🔍 Price Debug - Raw value: "${value}", Cleaned: "${cleaned}"`)
      
      const parsed = isInteger ? parseInt(cleaned, 10) : parseFloat(cleaned)
      const result = isNaN(parsed) ? 0 : parsed
      
      console.log(`🔍 Price Debug - Parsed result: ${result}`)
      return result
    }

    // Create a map of existing products
    const productMap = new Map(products.map(p => [p.sku, p]))

    // Process rows
    const newProducts = rows.slice(1).reduce((acc: GilmoursProductMap, row) => {
      if (row.length < headers.length) return acc // Skip invalid rows

      const sku = cleanField(row[skuIndex])
      if (!sku) return acc

      const rawPrice = row[priceIndex]
      const parsedPrice = parseNumber(rawPrice)
      
      console.log(`🔍 Product Debug - SKU: ${sku}, Raw price: "${rawPrice}", Parsed price: ${parsedPrice}`)
      
      const product: GilmoursProduct = {
        sku,
        brand: cleanField(row[brandIndex]),
        description: cleanField(row[descIndex]),
        packSize: cleanField(row[packIndex]),
        uom: cleanField(row[uomIndex]),
        price: parsedPrice,
        quantity: parseNumber(row[qtyIndex], true),
      }

      console.log(`🔍 Product Debug - Final product:`, product)
      acc.set(sku, product)
      return acc
    }, productMap)

    const productsArray = Array.from(newProducts.values())
    
    // Store debug data for UI display
    setDebugData({
      headers,
      columnIndices: { skuIndex, brandIndex, descIndex, packIndex, uomIndex, priceIndex, qtyIndex },
      firstRows: rows.slice(0, 3),
      processedProducts: productsArray.slice(0, 3)
    })
    
    // Save to database via API
    try {
      const response = await fetch('/api/gilmours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productsArray),
      })
      
      if (!response.ok) {
        throw new Error('Failed to save products')
      }
      
      // Update local state with the response from the server
      const savedProducts = await response.json()
      setProducts(savedProducts)
    } catch (error) {
      console.error('Error saving products:', error)
      // Still update local state even if API call fails
      setProducts(productsArray)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center gap-4">
        <Input
          type="file"
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
        >
          Upload CSV
        </Button>
      </div>

      {/* Debug Panel */}
      {debugData && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-bold mb-2">🔍 Debug Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Headers:</strong>
              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(debugData.headers, null, 2)}
              </pre>
            </div>
            <div>
              <strong>Column Indices:</strong>
              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(debugData.columnIndices, null, 2)}
              </pre>
            </div>
            <div>
              <strong>First 3 Raw Rows:</strong>
              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(debugData.firstRows, null, 2)}
              </pre>
            </div>
            <div>
              <strong>First 3 Processed Products:</strong>
              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(debugData.processedProducts, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Pack Size</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : (!products || products.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  No products found. Upload a CSV file to get started.
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                try {
                  const productsArray = Array.isArray(products) ? products : []
                  return productsArray.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.brand}</TableCell>
                      <TableCell>{product.description}</TableCell>
                      <TableCell>{product.packSize}</TableCell>
                      <TableCell>{product.uom}</TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                    </TableRow>
                  ))
                } catch (error) {
                  console.error('Error rendering Gilmours products:', error)
                  return (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-red-500">
                        Error rendering products. Please try refreshing the page.
                      </TableCell>
                    </TableRow>
                  )
                }
              })()
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 