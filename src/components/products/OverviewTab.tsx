'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

type ProductVariant = {
  id: string
  productId: string
  shopifyTitle: string
  displayName?: string | null
  shopifyPrice: number | string
  totalCost?: number | null
}

type ShopifyProduct = {
  id: string
  productTitle: string
  displayName?: string | null
  variants: ProductVariant[]
}

export function OverviewTab() {
  const [rows, setRows] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/products', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load products')
        const data: ShopifyProduct[] = await res.json()
        const variants = Array.isArray(data) ? data.flatMap(p => p.variants || []) : []
        setRows(variants)
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!q) return rows
    const s = q.toLowerCase()
    return rows.filter(v =>
      (v.displayName || v.shopifyTitle || '').toLowerCase().includes(s)
    )
  }, [rows, q])

  const currency = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle>Overview</CardTitle>
        <div className="flex items-center gap-2">
          <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product name</TableHead>
                <TableHead className="text-right">Price EX GST</TableHead>
                <TableHead className="text-right">Price incl</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No products</TableCell></TableRow>
              ) : (
                filtered.map(v => {
                  const incl = Number(v.shopifyPrice || 0)
                  const ex = incl / 1.15
                  const cost = Number(v.totalCost || 0)
                  const margin = ex > 0 ? (ex - cost) / ex : 0
                  const name = (v.displayName && v.displayName.trim().length > 0) ? v.displayName : v.shopifyTitle
                  return (
                    <TableRow key={v.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{currency(ex)}</TableCell>
                      <TableCell className="text-right">{currency(incl)}</TableCell>
                      <TableCell className="text-right">{currency(cost)}</TableCell>
                      <TableCell className="text-right">{(margin * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

