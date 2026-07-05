'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface CompanyOption {
  companyId: string
  companyName: string
  domain: string | null
  revenue: number
  orders: number
  contacts: number
}

export function CompanySearchSelect({
  value,
  onChange,
  allowCreate = false,
  createLabel = 'Create company',
}: {
  value?: string
  onChange: (selection: { companyId?: string; companyName?: string; domain?: string | null }) => void
  allowCreate?: boolean
  createLabel?: string
}) {
  const [query, setQuery] = useState(value || '')
  const [rows, setRows] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!query.trim()) {
        setRows([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/companies/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        if (!cancelled) setRows(Array.isArray(data.rows) ? data.rows : [])
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search company name/domain/address"
      />
      {loading ? <p className="text-xs text-muted-foreground">Searching...</p> : null}
      <div className="max-h-56 overflow-auto rounded border">
        {rows.map((row) => (
          <button
            key={row.companyId}
            className="w-full px-3 py-2 text-left hover:bg-muted border-b last:border-b-0"
            onClick={() => onChange({ companyId: row.companyId, companyName: row.companyName, domain: row.domain })}
            type="button"
          >
            <div className="font-medium">{row.companyName}</div>
            <div className="text-xs text-muted-foreground">
              {row.domain || '-'} | ${row.revenue.toLocaleString('en-NZ')} | {row.orders} orders | {row.contacts} contacts
            </div>
          </button>
        ))}
        {!loading && rows.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
        ) : null}
      </div>
      {allowCreate ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              companyName: query.trim(),
            })
          }
          disabled={!query.trim()}
        >
          {createLabel}: "{query.trim()}"
        </Button>
      ) : null}
    </div>
  )
}
