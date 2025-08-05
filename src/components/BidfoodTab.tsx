'use client'

import { useRef, useState, useEffect } from 'react'
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
import { Dispatch, SetStateAction } from 'react'

export interface BidfoodProduct {
  id: string
  productCode: string
  brand: string
  description: string
  packSize: string
  ctnQty: string
  uom: string
  qty: number
  lastPricePaid: number
  totalExGST: number
  contains: string
  createdAt: string
  updatedAt: string
}

interface BidfoodTabProps {
  products: BidfoodProduct[]
  setProducts: Dispatch<SetStateAction<BidfoodProduct[]>>
  isLoading: boolean
  error?: string | null
}

export function BidfoodTab({ products, setProducts, isLoading, error: propError }: BidfoodTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [allergenMap, setAllergenMap] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(propError || null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Debug logging
  console.log('BidfoodTab render - products:', products, 'type:', typeof products, 'isArray:', Array.isArray(products))

  // Predefined mapping for common allergen descriptions
  const allergenDescriptionMap: Record<string, string> = {
    "Gluten (Cereals containing Wheat, Rye, Barley, Oats & Spelt)": "Gluten",
    "Sesame Seeds and Sesame Seed Products": "Sesame",
    "Wheat (including its hybridised strain) ) (irrespective of whether it contains Gluten)": "Wheat",
    "Milk and Milk Products": "Milk",
    "Eggs and Egg Products": "Eggs",
    "Fish and Fish Products": "Fish",
    "Crustaceans and Crustacean Products": "Crustaceans",
    "Tree Nuts and Tree Nut Products": "Tree Nuts",
    "Peanuts and Peanut Products": "Peanuts",
    "Soybeans and Soybean Products": "Soy",
    "Celery and Celery Products": "Celery",
    "Mustard and Mustard Products": "Mustard",
    "Lupin and Lupin Products": "Lupin",
    "Molluscs and Mollusc Products": "Molluscs",
    "Sulphites": "Sulphites"
  }

  // Update error state when prop changes
  useEffect(() => {
    if (propError) {
      setError(propError)
    }
  }, [propError])

  // Load allergen abbreviation map
  useEffect(() => {
    const loadAllergenMap = async () => {
      try {
        const response = await fetch('/data/allergen_abbreviation_map.csv')
        if (!response.ok) {
          throw new Error(`Failed to load allergen map: ${response.statusText}`)
        }
        const text = await response.text()
        const rows = text.split('\n').slice(1) // Skip header row
        const map: Record<string, string> = {}
        
        rows.forEach(row => {
          const [fullName, abbreviation] = row.split(',')
          if (fullName && abbreviation) {
            map[abbreviation.trim()] = fullName.trim()
          }
        })
        
        setAllergenMap(map)
        console.log('Allergen map loaded successfully:', map)
      } catch (error) {
        console.error('Error loading allergen map:', error)
        setError('Failed to load allergen abbreviations. Allergens will be displayed in full.')
      }
    }

    loadAllergenMap()
  }, [])

  // Clean and format allergen information
  const cleanAllergens = (contains: string): string => {
    if (!contains) return ''
    
    console.log(`Cleaning allergens from: "${contains}"`)
    
    // Split by comma and trim each allergen
    const allergens = contains.split(',').map(allergen => allergen.trim())
    console.log(`Split allergens:`, allergens)
    
    // Filter out entries containing "THE CATER STATION" using regex
    const filteredAllergens = allergens.filter(allergen => 
      !/THE CATER STATION/i.test(allergen)
    )
    console.log(`Filtered allergens:`, filteredAllergens)
    
    // Map each allergen to its simplified form
    const mappedAllergens = filteredAllergens.map(allergen => {
      // First check if it's in our predefined mapping
      if (allergenDescriptionMap[allergen]) {
        console.log(`Mapped "${allergen}" to "${allergenDescriptionMap[allergen]}" using predefined map`)
        return allergenDescriptionMap[allergen]
      }
      
      // Then check if it's an abbreviation that maps to a full name
      if (allergenMap[allergen]) {
        console.log(`Mapped "${allergen}" to "${allergenMap[allergen]}" using abbreviation map`)
        return allergenMap[allergen]
      }
      
      // If not found in either map, keep the original
      console.log(`No mapping found for "${allergen}", keeping original`)
      return allergen
    })
    
    // Remove duplicates and empty strings, then join with commas
    const result = [...new Set(mappedAllergens.filter(Boolean))].join(', ')
    console.log(`Final allergen string: "${result}"`)
    return result
  }

  const simplifyAllergens = (contains: string): string => {
    return cleanAllergens(contains)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const text = await file.text()
      const rows = text.split('\n')
      
      // Extract headers from the first row
      const headers = rows[0].split(',').map(header => 
        header.replace(/^["']|["']$/g, '').trim()
      )
      
      console.log('CSV Headers:', headers)
      
      // Find the index of the Contains column
      const containsIndex = headers.findIndex(header => 
        header.toLowerCase() === 'contains'
      )
      
      if (containsIndex === -1) {
        console.warn('Contains column not found in CSV headers')
      } else {
        console.log(`Contains column found at index ${containsIndex}`)
      }
      
      // Process data rows (skip header row)
      const productMap = new Map<string, BidfoodProduct>()

      rows.slice(1).forEach((row, index) => {
        if (!row.trim()) return

        // Split the row by comma, but handle quoted fields properly
        const fields = row.split(',').map(field => {
          // Remove quotes if present and trim whitespace
          return field.replace(/^["']|["']$/g, '').trim()
        })

        // Extract product code (assuming it's the first column)
        const productCode = fields[0]
        
        if (!productCode) {
          console.warn(`Skipping row ${index + 2}: Missing product code`)
          return
        }
        
        // Extract the Contains field using the correct index
        const rawContains = containsIndex !== -1 ? fields[containsIndex] : ''
        console.log(`Product ${productCode} - Raw Contains field: "${rawContains}"`)
        
        // Clean the contains field
        const processedContains = cleanAllergens(rawContains || '')
        console.log(`Product ${productCode} - Processed Contains field: "${processedContains}"`)

        // Extract other fields (assuming standard order)
        const [
          _productCode, // Already extracted
          brand,
          description,
          packSize,
          ctnQty,
          uom,
          qty,
          lastPricePaid,
          totalExGST,
          _contains // Already extracted
        ] = fields

        const newProduct: BidfoodProduct = {
          id: '', // Will be generated by the database
          productCode,
          brand: brand || '',
          description: description || '',
          packSize: packSize || '',
          ctnQty: ctnQty || '',
          uom: uom || '',
          qty: Number(qty) || 0,
          lastPricePaid: Number(lastPricePaid) || 0,
          totalExGST: Number(totalExGST) || 0,
          contains: processedContains,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // Handle duplicates by keeping the lower-priced item
        if (productMap.has(productCode)) {
          const existingProduct = productMap.get(productCode)!
          // Keep the product with the lower price
          if (newProduct.lastPricePaid < existingProduct.lastPricePaid) {
            productMap.set(productCode, newProduct)
          }
        } else {
          productMap.set(productCode, newProduct)
        }
      })

      const newProducts = Array.from(productMap.values())

      if (newProducts.length === 0) {
        throw new Error('No valid products found in the CSV file')
      }

      console.log(`Successfully processed ${newProducts.length} products`)
      console.log('Sample product contains field:', newProducts[0].contains)

      // Save to database via API
      const response = await fetch('/api/bidfood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProducts),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save products')
      }

      const savedProducts = await response.json()
      setProducts(savedProducts)
    } catch (error) {
      console.error('Error processing file:', error)
      setError(error instanceof Error ? error.message : 'Failed to process file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload CSV'}
        </Button>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Code</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Pack Size</TableHead>
              <TableHead>CTN Qty</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Last Price Paid</TableHead>
              <TableHead>Qualified Price</TableHead>
              <TableHead>Total Ex GST</TableHead>
              <TableHead>Contains</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : (!products || products.length === 0) ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  No products found. Upload a CSV file to get started.
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                try {
                  const productsArray = Array.isArray(products) ? products : []
                  return productsArray.map((product) => (
                    <TableRow key={product.productCode}>
                      <TableCell>{product.productCode}</TableCell>
                      <TableCell>{product.brand}</TableCell>
                      <TableCell>{product.description}</TableCell>
                      <TableCell>{product.packSize}</TableCell>
                      <TableCell>{product.ctnQty}</TableCell>
                      <TableCell>{product.uom}</TableCell>
                      <TableCell>{product.qty}</TableCell>
                      <TableCell>${product.lastPricePaid.toFixed(2)}</TableCell>
                      <TableCell>
                        ${(product.uom.toLowerCase() === 'carton' 
                          ? (product.lastPricePaid / Number(product.ctnQty || 1))
                          : product.lastPricePaid
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell>${product.totalExGST.toFixed(2)}</TableCell>
                      <TableCell>{simplifyAllergens(product.contains)}</TableCell>
                    </TableRow>
                  ))
                } catch (error) {
                  console.error('Error rendering Bidfood products:', error)
                  return (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-red-500">
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