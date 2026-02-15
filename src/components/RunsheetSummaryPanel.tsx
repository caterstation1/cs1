import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

interface RunsheetSummaryPanelProps {
  targetDate: Date
  city?: 'AKL' | 'WLG'
  autoRefresh?: boolean
  refreshInterval?: number
  className?: string
}

type TasksByCategory = Record<string, { name: string; items: Record<string, { total: number; am: number }> }>

export function RunsheetSummaryPanel({ targetDate, city = 'AKL', autoRefresh = false, refreshInterval = 30000, className = '' }: RunsheetSummaryPanelProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    orderCount: number
    boxesCount: number
    servewareBoxes: number
    tasksByCategory: TasksByCategory
    addonsList: Array<{ name: string; total: number; am: number }>
    proteinsByInitial: Array<{ initial: string; total: number; am: number }>
  } | null>(null)

  const dateStr = useMemo(() => {
    const y = targetDate.getFullYear()
    const m = String(targetDate.getMonth() + 1).padStart(2, '0')
    const d = String(targetDate.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [targetDate])

  const fetchSummary = async (isRefreshing = false) => {
    try {
      setError(null)
      if (isRefreshing) setRefreshing(true)
      else setLoading(true)
      const params = new URLSearchParams({ date: dateStr, city, remaining: '1' })
      const res = await fetch(`/api/runsheet/summary?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load runsheet summary')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load runsheet summary')
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchSummary() }, [dateStr, city])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => fetchSummary(true), Math.max(10000, refreshInterval))
    return () => clearInterval(id)
  }, [autoRefresh, refreshInterval, dateStr, city])

  const renderList = (title: string, itemsMap?: Record<string, { total: number; am: number }>) => {
    const items = itemsMap ? Object.entries(itemsMap).map(([name, v]) => ({ name, total: v.total, am: v.am })) : []
    const sorted = items.sort((a, b) => b.total - a.total).slice(0, 20)
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold">{title}</div>
        {sorted.length === 0 ? <div className="text-xs text-gray-500">—</div> : (
          <ul className="text-sm space-y-1">
            {sorted.map(item => (
              <li key={item.name} className="flex justify-between">
                <span className="truncate">{item.name}</span>
                <span className="text-gray-600">{item.total}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const renderProteins = () => {
    const list = (data?.proteinsByInitial || []).slice().sort((a, b) => a.initial.localeCompare(b.initial))
    if (list.length === 0) return <div className="text-xs text-gray-500">—</div>
    return (
      <div className="grid grid-cols-4 gap-2 text-sm">
        {list.map(p => (
          <div key={p.initial} className="flex justify-between">
            <span>{p.initial}</span>
            <span className="text-gray-600">{p.total}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`rounded-lg bg-white shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Runsheet Summary ({city})</div>
        <div className="flex items-center gap-2">
          {refreshing && <span className="text-xs text-gray-500">Refreshing…</span>}
          <Button size="sm" variant="outline" onClick={() => fetchSummary(true)}>Refresh</Button>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500">Orders</div>
              <div className="font-semibold">{data.orderCount}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500">Boxes</div>
              <div className="font-semibold">{data.boxesCount}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-gray-500">SW Boxes</div>
              <div className="font-semibold">{data.servewareBoxes}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {renderList('Cold kitchen', data.tasksByCategory?.['Cold kitchen']?.items)}
            {renderList('Hot kitchen', data.tasksByCategory?.['Hot kitchen']?.items)}
            {renderList('Desserts', data.tasksByCategory?.['Desserts']?.items)}
            {renderList('Addons', Object.fromEntries((data.addonsList || []).map(a => [a.name, { total: a.total, am: a.am }])) )}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Proteins</div>
            {renderProteins()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">No data</div>
      )}
    </div>
  )
}

