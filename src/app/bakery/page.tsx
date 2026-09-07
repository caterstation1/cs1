'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Matrix = Record<string, number[]>

function sumSelected(arr: number[], selected: boolean[]) {
  return arr.reduce((acc, n, i) => acc + (selected[i] ? n : 0), 0)
}

export default function BakeryPage() {
  const [city, setCity] = useState<'AKL' | 'WLG'>('AKL')
  const [start, setStart] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))
  const [days, setDays] = useState(7)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<boolean[]>(Array(7).fill(true))
  const [imagePreview, setImagePreview] = useState<{ name: string; url: string | null } | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bakery/summary?city=${city}&start=${start}&days=${days}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
      setSelected(Array((json?.days || []).length).fill(true))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [city, start, days])

  const dayLabels = useMemo(() => {
    if (!data?.days) return []
    return data.days.map((iso: string, idx: number) => {
      const dt = addDays(new Date(start), idx)
      return format(dt, 'EEE dd')
    })
  }, [data?.days, start])

  const matrix: Matrix = data?.products || {}
  const keys = Object.keys(matrix).sort((a, b) => a.localeCompare(b))
  const imgMap = data?.productImages || {}

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Bakery</h1>
        <div className="flex items-center gap-2">
          <Tabs value={city} onValueChange={v => setCity(v as 'AKL' | 'WLG')}>
            <TabsList>
              <TabsTrigger value="AKL">AKL</TabsTrigger>
              <TabsTrigger value="WLG">WLG</TabsTrigger>
            </TabsList>
          </Tabs>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <select
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[7, 14, 21].map(n => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {data ? (
        <>
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Bakery items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">Item</th>
                    {dayLabels.map((d: string, i: number) => (
                      <th key={i} className="border px-2 py-1 text-right">
                        {d}
                      </th>
                    ))}
                    <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10">Selected Total</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">Select days</th>
                    {dayLabels.map((_: string, i: number) => (
                      <th key={i} className="border px-2 py-1 text-center">
                        <Checkbox
                          checked={!!selected[i]}
                          onCheckedChange={v => {
                            setSelected(prev => prev.map((b, idx) => (idx === i ? !!v : b)))
                          }}
                        />
                      </th>
                    ))}
                    <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.length === 0 ? (
                    <tr>
                      <td colSpan={(dayLabels.length || 0) + 2} className="border px-2 py-4 text-center text-gray-500">
                        No bakery items in this range.
                      </td>
                    </tr>
                  ) : (
                    keys.map(k => (
                      <tr key={k}>
                        <td className="border px-2 py-1 sticky left-0 bg-white z-10">
                          <button
                            type="button"
                            className="text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-normal"
                            onClick={() => setImagePreview({ name: k, url: imgMap[k] || null })}
                          >
                            {k}
                          </button>
                        </td>
                        {matrix[k].map((n, i) => (
                          <td key={i} className="border px-2 py-1 text-right">
                            {n || ''}
                          </td>
                        ))}
                        <td className="border px-2 py-1 text-right sticky right-0 bg-white z-10">
                          {sumSelected(matrix[k], selected)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div>Loading…</div>
      )}

      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
          onClick={() => setImagePreview(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-[min(90vw,42rem)] max-h-[90vh] overflow-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-lg leading-none flex items-center justify-center"
              onClick={() => setImagePreview(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="font-semibold text-lg pr-10 mb-3">{imagePreview.name}</h3>
            {imagePreview.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview.url}
                alt={imagePreview.name}
                className="max-w-full max-h-[70vh] w-auto mx-auto object-contain rounded border border-gray-100"
              />
            ) : (
              <p className="text-gray-500 text-sm py-8 text-center">No image on file for this product.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
