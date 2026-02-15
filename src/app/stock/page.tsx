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

export default function StockPage() {
  const [city, setCity] = useState<'AKL'|'WLG'>('AKL')
  const [start, setStart] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))
  const [days, setDays] = useState(7)
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<boolean[]>(Array(7).fill(true))
  const [rawOnly, setRawOnly] = useState(true)

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stock/summary?city=${city}&start=${start}&days=${days}&raw=${rawOnly ? '1' : '0'}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
      setSelected(Array((json?.days || []).length).fill(true))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSummary() }, [city, start, days, rawOnly])

  const dayLabels = useMemo(() => {
    if (!data?.days) return []
    return data.days.map((iso: string, idx: number) => {
      const dt = addDays(new Date(start), idx)
      return format(dt, 'EEE dd')
    })
  }, [data?.days, start])

  const renderSection = (title: string, matrix: Matrix) => {
    const keys = Object.keys(matrix).sort((a,b)=> a.localeCompare(b))
    if (keys.length === 0) return null
    return (
      <div className="mt-6">
        <h3 className="font-semibold mb-2">{title}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">Item</th>
                {dayLabels.map((d: string, i: number) => (
                  <th key={i} className="border px-2 py-1 text-right">{d}</th>
                ))}
                <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10">Selected Total</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">Select days</th>
                {dayLabels.map((_: string, i: number) => (
                  <th key={i} className="border px-2 py-1 text-center">
                    <Checkbox checked={!!selected[i]} onCheckedChange={(v)=> {
                      setSelected(prev => prev.map((b, idx)=> idx===i ? !!v : b))
                    }} />
                  </th>
                ))}
                <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k}>
                  <td className="border px-2 py-1 sticky left-0 bg-white z-10">{k}</td>
                  {matrix[k].map((n, i) => (
                    <td key={i} className="border px-2 py-1 text-right">{n || ''}</td>
                  ))}
                  <td className="border px-2 py-1 text-right sticky right-0 bg-white z-10">{sumSelected(matrix[k], selected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const proteinsSection = () => {
    if (!data?.proteins) return null
    const matrix: Matrix = data.proteins
    // Add C-Total row
    if (data.proteinsCTotal) {
      matrix['C-Total'] = data.proteinsCTotal
    }
    return renderSection('Proteins', matrix)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Stock</h1>
        <div className="flex items-center gap-2">
          <Tabs defaultValue={city} onValueChange={(v)=> setCity(v as any)}>
            <TabsList>
              <TabsTrigger value="AKL">AKL</TabsTrigger>
              <TabsTrigger value="WLG">WLG</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={rawOnly} onChange={(e)=> setRawOnly(e.target.checked)} />
            Raw ingredients only
          </label>
          <input type="date" value={start} onChange={e=> setStart(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <select value={days} onChange={e=> setDays(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
            {[7,14,21].map(n=> <option key={n} value={n}>{n} days</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
        </div>
      </div>

      {data ? (
        <>
          {/* Raw Ingredients Section */}
          {rawOnly && data.raw && renderSection('Raw Ingredients', data.raw || {})}
          {/* SW row as its own section */}
          {data.sw && (
            <div className="mt-2">
              <h3 className="font-semibold mb-2">Serveware (SW)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">SW</th>
                      {dayLabels.map((d: string, i: number) => <th key={i} className="border px-2 py-1 text-right">{d}</th>)}
                      <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10">Selected Total</th>
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-left sticky left-0 bg-gray-50 z-10">Select days</th>
                      {dayLabels.map((_: string, i: number) => (
                        <th key={i} className="border px-2 py-1 text-center">
                          <Checkbox checked={!!selected[i]} onCheckedChange={(v)=> {
                            setSelected(prev => prev.map((b, idx)=> idx===i ? !!v : b))
                          }} />
                        </th>
                      ))}
                      <th className="border px-2 py-1 text-right sticky right-0 bg-gray-50 z-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-2 py-1 sticky left-0 bg-white z-10">SW</td>
                      {data.sw.map((n: number, i: number) => <td key={i} className="border px-2 py-1 text-right">{n || ''}</td>)}
                      <td className="border px-2 py-1 text-right sticky right-0 bg-white z-10">{sumSelected(data.sw, selected)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {renderSection('Products', data.products || {})}
          {renderSection('Add-ons', data.addons || {})}
          {!rawOnly && renderSection('Cold Kitchen', data.cold || {})}
          {!rawOnly && renderSection('Hot Kitchen', data.hot || {})}
          {!rawOnly && renderSection('Desserts', data.desserts || {})}
          {proteinsSection()}
        </>
      ) : (
        <div>Loading…</div>
      )}
    </div>
  )
}


