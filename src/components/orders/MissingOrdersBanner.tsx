'use client'

import { useEffect, useState } from 'react'

export function MissingOrdersBanner({ onFixed }: { onFixed?: () => void }) {
  const [missing, setMissing] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/orders/missing')
      if (!res.ok) return
      const data = await res.json()
      setMissing(Array.isArray(data.missingNumbers) ? data.missingNumbers : [])
    } catch {}
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  if (!missing || missing.length === 0) return null

  const first = missing[0]

  const handleRefetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/refetch-by-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: first }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(()=> '')
        setError(txt || 'Failed to refetch order')
      } else {
        await load()
        if (onFixed) {
          onFixed()
        } else {
          try {
            if (typeof window !== 'undefined') window.location.reload()
          } catch {}
        }
      }
    } catch (e) {
      setError('Failed to refetch order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-3 rounded border-2 border-red-500 bg-red-50 p-3 text-red-800">
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold">
          *** MISSING ORDER ***
        </div>
        <div className="text-sm">
          We detected missing order number(s): {missing.join(', ')}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefetch}
            disabled={loading}
            className="px-3 py-1 rounded border border-red-600 bg-white text-red-700 hover:bg-red-100 disabled:opacity-50"
            title="Attempt to fetch the most recent missing order from Shopify"
          >
            {loading ? 'Refetching…' : `Refetch ${first}`}
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-sm">{error}</div>}
    </div>
  )
}

