'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dispatch, SetStateAction } from 'react'
import { parseCsvRows } from '@/lib/csv'

export interface ProduceCoProduct {
  id: string
  productCode: string
  productName: string
  totalUnits: number
  totalSales: number
  price: number
  isPreferred?: boolean
  preferredReference?: string | null
  preferredAllergens?: string[]
  createdAt?: string
  updatedAt?: string
}

interface ProduceCoTabProps {
  products: ProduceCoProduct[]
  setProducts: Dispatch<SetStateAction<ProduceCoProduct[]>>
  isLoading: boolean
  error?: string | null
  onTogglePreferred?: (id: string, nextPreferred: boolean) => void | Promise<void>
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function ProduceCoTab({
  products,
  setProducts,
  isLoading,
  error,
  onTogglePreferred,
}: ProduceCoTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)
    try {
      const text = await file.text()
      const rows = parseCsvRows(text)
      if (rows.length < 2) throw new Error('CSV has no data rows')

      const headers = rows[0].map((header) => header.trim().toLowerCase())
      const productCodeIndex = headers.findIndex((h) => h === 'product code')
      const productNameIndex = headers.findIndex((h) => h === 'product name')
      const totalUnitsIndex = headers.findIndex((h) => h === 'total units')
      const totalSalesIndex = headers.findIndex((h) => h === 'total sales')
      const priceIndex = headers.findIndex((h) => h === 'price')

      if ([productCodeIndex, productNameIndex, totalUnitsIndex, totalSalesIndex, priceIndex].some((idx) => idx < 0)) {
        throw new Error('CSV headers must be: Product Code, Product Name, Total Units, Total Sales, Price')
      }

      const parsedRows: ProduceCoProduct[] = rows.slice(1).map((cols) => {
        const productCode = String(cols[productCodeIndex] || '').trim()
        return {
          id: '',
          productCode,
          productName: String(cols[productNameIndex] || '').trim(),
          totalUnits: Math.trunc(parseNumber(cols[totalUnitsIndex])),
          totalSales: parseNumber(cols[totalSalesIndex]),
          price: parseNumber(cols[priceIndex]),
        }
      }).filter((row) => row.productCode)

      const response = await fetch('/api/produce-co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedRows),
      })
      if (!response.ok) throw new Error('Failed to save Produce Co products')

      const savedProducts = await response.json()
      setProducts(savedProducts)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to process CSV')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Upload CSV'}
        </Button>
        {(error || uploadError) ? (
          <p className="text-sm text-red-500">{uploadError || error}</p>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Code</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Total Units</TableHead>
              <TableHead>Total Sales</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : (!products || products.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No products found. Upload a CSV file to get started.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id || product.productCode}>
                  <TableCell>{product.productCode}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.isPreferred)}
                      onChange={(e) => {
                        const nextPreferred = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, isPreferred: nextPreferred } : item
                          )
                        )
                        if (product.id) {
                          void onTogglePreferred?.(product.id, nextPreferred)
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>{product.productName}</TableCell>
                  <TableCell>{product.totalUnits}</TableCell>
                  <TableCell>${(product.totalSales || 0).toFixed(2)}</TableCell>
                  <TableCell>${(product.price || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
