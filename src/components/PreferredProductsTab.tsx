'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PreferredProductItem = {
  source: 'gilmours' | 'produce_co' | 'bidfood' | 'other'
  id: string
  code: string
  brandOrSupplier: string
  description: string
  preferredReference: string | null
  preferredAllergens: string[]
}

interface PreferredProductsTabProps {
  products: PreferredProductItem[]
  onProductSave: (
    source: PreferredProductItem['source'],
    id: string,
    payload: {
      preferredReference: string | null
      preferredAllergens: string[]
    }
  ) => Promise<void> | void
}

const ALLERGEN_OPTIONS = [
  'gluten',
  'sesame',
  'soy',
  'garlic',
  'onion',
  'dairy',
  'milk',
  'egg',
  'fish',
  'nuts',
  'sulphites',
] as const

const ALLERGEN_LABELS: Record<(typeof ALLERGEN_OPTIONS)[number], string> = {
  gluten: 'Gluten',
  sesame: 'Sesame',
  soy: 'Soy',
  garlic: 'Garlic',
  onion: 'Onion',
  dairy: 'Dairy',
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  nuts: 'Nuts',
  sulphites: 'Sulphites',
}

function normalizePreferredAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
        .filter((item): item is (typeof ALLERGEN_OPTIONS)[number] =>
          ALLERGEN_OPTIONS.includes(item as (typeof ALLERGEN_OPTIONS)[number])
        )
    )
  )
}

export function PreferredProductsTab({ products, onProductSave }: PreferredProductsTabProps) {
  const [draftByKey, setDraftByKey] = useState<Record<string, string>>({})
  const [allergenDraftByKey, setAllergenDraftByKey] = useState<Record<string, string[]>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aName = (a.preferredReference || a.description || '').toLowerCase()
      const bName = (b.preferredReference || b.description || '').toLowerCase()
      return aName.localeCompare(bName)
    })
  }, [products])

  const getDraft = (item: PreferredProductItem) => {
    const key = `${item.source}:${item.id}`
    const draft = draftByKey[key]
    return draft !== undefined ? draft : item.preferredReference || ''
  }

  const getDraftAllergens = (item: PreferredProductItem) => {
    const key = `${item.source}:${item.id}`
    return allergenDraftByKey[key] !== undefined
      ? normalizePreferredAllergens(allergenDraftByKey[key])
      : normalizePreferredAllergens(item.preferredAllergens)
  }

  const saveProduct = async (item: PreferredProductItem) => {
    const key = `${item.source}:${item.id}`
    const value = (draftByKey[key] ?? item.preferredReference ?? '').trim()
    const preferredAllergens = getDraftAllergens(item)
    setSavingKey(key)
    try {
      await onProductSave(item.source, item.id, {
        preferredReference: value || null,
        preferredAllergens,
      })
    } finally {
      setSavingKey(null)
    }
  }

  const downloadCsv = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const headers = [
      'Reference name',
      'Source',
      'Code',
      'Brand / Supplier',
      'Original item',
      'Contains allergens',
    ]
    const rows = sortedProducts.map((item) => {
      const allergens = getDraftAllergens(item)
        .map((key) => ALLERGEN_LABELS[key as (typeof ALLERGEN_OPTIONS)[number]] || key)
        .join(', ')
      return [
        getDraft(item),
        item.source.toUpperCase(),
        item.code,
        item.brandOrSupplier || '',
        item.description,
        allergens,
      ]
    })

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map((value) => escapeCsv(String(value || ''))).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `preferred-products-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={downloadCsv}>
          Download CSV
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Brand / Supplier</TableHead>
              <TableHead>Original item</TableHead>
              <TableHead>Contains</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No preferred products yet. Tick items in Bidfood, Gilmours, or Other.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((item) => {
                const key = `${item.source}:${item.id}`
                return (
                  <TableRow key={key}>
                    <TableCell className="min-w-[220px]">
                      <Input
                        value={getDraft(item)}
                        placeholder="Enter reference name (e.g. Bacon)"
                        onChange={(e) =>
                          setDraftByKey((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        onBlur={() => void saveProduct(item)}
                      />
                    </TableCell>
                    <TableCell className="uppercase">{item.source}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.brandOrSupplier || '-'}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="min-w-[320px]">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {ALLERGEN_OPTIONS.map((allergen) => {
                          const checked = getDraftAllergens(item).includes(allergen)
                          return (
                            <label key={`${key}:${allergen}`} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setAllergenDraftByKey((prev) => {
                                    const current = prev[key] ?? normalizePreferredAllergens(item.preferredAllergens)
                                    const next = e.target.checked
                                      ? [...current, allergen]
                                      : current.filter((entry) => entry !== allergen)
                                    return { ...prev, [key]: normalizePreferredAllergens(next) }
                                  })
                                }}
                              />
                              <span>{ALLERGEN_LABELS[allergen]}</span>
                            </label>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={savingKey === key}
                        onClick={() => void saveProduct(item)}
                      >
                        {savingKey === key ? 'Saving...' : 'Save'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
