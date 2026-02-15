'use client'

import { useState } from 'react'

interface AskResult {
  answer?: string
  evidence?: {
    tables?: Array<{ name: string; rows: any[] }>
    totals?: Record<string, number | string>
    sql?: string
    links?: Array<{ label: string; href: string }>
  }
  error?: string
}

export function AskAIButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="ml-2 inline-flex items-center rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
        onClick={() => setOpen(true)}
        title="Ask AI"
      >
        ✨ Ask AI
      </button>
      {open && <AskAIModal onClose={() => setOpen(false)} />}
    </>
  )
}

export function AskAIModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [includePII, setIncludePII] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)

  async function submit() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, includePII }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = [data?.error, data?.details].filter(Boolean).join(': ')
        setResult({ error: errMsg || `Request failed (${res.status})` })
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setResult({ error: e?.message || 'Failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ask AI</h2>
          <button onClick={onClose} className="rounded px-2 py-1 hover:bg-gray-100">✕</button>
        </div>
        <div className="mt-3">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-24 w-full rounded border border-gray-300 p-2"
            placeholder='e.g., "How much did we spend on chicken thigh last year?"'
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includePII} onChange={(e) => setIncludePII(e.target.checked)} />
              Include PII in evidence (emails/phones)
            </label>
            <button
              className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={submit}
              disabled={loading || !q.trim()}
            >
              {loading ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-[50vh] overflow-auto">
          {result?.error && (
            <div className="rounded bg-red-50 p-3 text-red-700">{result.error}</div>
          )}
          {result?.answer && (
            <div className="space-y-3">
              <div className="rounded bg-green-50 p-3 text-green-800">{result.answer}</div>
              {result.evidence?.totals && (
                <div className="rounded border p-2">
                  <div className="font-medium">Totals</div>
                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result.evidence.totals, null, 2)}</pre>
                </div>
              )}
              {result.evidence?.tables?.map((t, i) => (
                <div key={i} className="rounded border p-2">
                  <div className="font-medium">{t.name}</div>
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(t.rows, null, 2)}</pre>
                </div>
              ))}
              {result.evidence?.sql && (
                <div className="rounded border p-2">
                  <div className="font-medium">SQL used</div>
                  <pre className="whitespace-pre-wrap text-xs">{result.evidence.sql}</pre>
                </div>
              )}
              {result.evidence?.links && result.evidence.links.length > 0 && (
                <div className="rounded border p-2">
                  <div className="font-medium">Links</div>
                  <ul className="list-inside list-disc">
                    {result.evidence.links.map((l, i) => (
                      <li key={i}><a className="text-blue-700 underline" href={l.href}>{l.label}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



