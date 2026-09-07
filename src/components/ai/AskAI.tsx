'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface AskCandidate {
  id: string
  kind: string
  name: string
  subtitle?: string
  phone?: string | null
  email?: string | null
  href?: string
}

interface AskChangeLine {
  field: string
  label: string
  before: string | null
  after: string | null
}

interface AskProposal {
  confirmToken: string
  title: string
  summary: string
  orderNumber: number
  orderContext: Record<string, string | null>
  changes: AskChangeLine[]
  unchangedNote: string
}

interface AskAction {
  type: 'open_url' | 'confirm'
  label: string
  href?: string
  confirmToken?: string
}

interface AskResult {
  answer?: string
  candidates?: AskCandidate[]
  proposal?: AskProposal
  actions?: AskAction[]
  evidence?: {
    tables?: Array<{ name: string; rows: any[] }>
    totals?: Record<string, number | string>
    sql?: string
    links?: Array<{ label: string; href: string }>
  }
  error?: string
}

export function AskAIButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700',
          className,
        )}
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
  const [mounted, setMounted] = useState(false)
  const [q, setQ] = useState('')
  const [includePII, setIncludePII] = useState(true)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)

  useEffect(() => {
    setMounted(true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

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

  async function confirmUpdate(token: string) {
    setConfirming(true)
    try {
      const res = await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmToken: token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data?.error || 'Confirm failed' })
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setResult({ error: e?.message || 'Confirm failed' })
    } finally {
      setConfirming(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-4 flex w-full max-w-3xl max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Ask AI</h2>
              <p className="text-sm text-gray-500">
                Look up data, print labels, or propose order updates (confirm before applying).
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-lg leading-none hover:bg-gray-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!loading && q.trim()) void submit()
                }
              }}
              className="h-24 w-full rounded border border-gray-300 p-2"
              placeholder={'e.g., "Sofia\'s number", "Print labels for 12945", "Update order 12234 delivery time to 11:30 AM"'}
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePII} onChange={(e) => setIncludePII(e.target.checked)} />
                Include phone numbers &amp; emails
              </label>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={submit}
                disabled={loading || !q.trim()}
              >
                {loading ? 'Thinking…' : 'Ask'}
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0 space-y-3">
          {result?.error && (
            <div className="rounded bg-red-50 p-3 text-red-700">{result.error}</div>
          )}
          {result?.answer && (
            <div className="rounded bg-green-50 p-3 text-green-800 whitespace-pre-wrap">{result.answer}</div>
          )}

          {result?.candidates && result.candidates.length > 0 && (
            <div className="rounded border p-3 space-y-2">
              <div className="font-medium">Matches</div>
              {result.candidates.map((c) => (
                <div key={c.id} className="rounded bg-gray-50 p-2 text-sm">
                  <div className="font-medium">{c.name}</div>
                  {c.subtitle && <div className="text-gray-600">{c.subtitle}</div>}
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div>{c.email}</div>}
                  {c.href && (
                    <a className="text-blue-700 underline text-xs" href={c.href}>Open</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {result?.proposal && (
            <div className="rounded border-2 border-amber-300 bg-amber-50 p-3 space-y-3">
              <div className="font-semibold">{result.proposal.title}</div>
              <div className="text-sm space-y-1">
                {result.proposal.orderContext.customer && (
                  <div><span className="font-medium">Customer:</span> {result.proposal.orderContext.customer}</div>
                )}
                {result.proposal.orderContext.deliveryDate && (
                  <div><span className="font-medium">Delivery date:</span> {result.proposal.orderContext.deliveryDate}</div>
                )}
                {result.proposal.orderContext.deliveryTime && (
                  <div><span className="font-medium">Current time:</span> {result.proposal.orderContext.deliveryTime}</div>
                )}
                {result.proposal.orderContext.status && (
                  <div><span className="font-medium">Status:</span> {result.proposal.orderContext.status}</div>
                )}
              </div>
              <div className="font-medium text-sm">Changes</div>
              <ul className="text-sm space-y-1">
                {result.proposal.changes.map((ch) => (
                  <li key={ch.field}>
                    <span className="font-medium">{ch.label}:</span>{' '}
                    <span className="text-gray-500">{ch.before ?? '—'}</span>
                    {' → '}
                    <span className="text-emerald-800 font-medium">{ch.after}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-600">{result.proposal.unchangedNote}</p>
              <button
                type="button"
                className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
                disabled={confirming}
                onClick={() => confirmUpdate(result.proposal!.confirmToken)}
              >
                {confirming ? 'Applying…' : `Confirm update to order #${result.proposal.orderNumber}`}
              </button>
            </div>
          )}

          {result?.actions && result.actions.length > 0 && !result?.proposal && (
            <div className="flex flex-wrap gap-2">
              {result.actions.map((action, i) => (
                action.type === 'open_url' && action.href ? (
                  <button
                    key={i}
                    type="button"
                    className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                    onClick={() => window.open(action.href!, '_blank', 'noopener,noreferrer')}
                  >
                    {action.label}
                  </button>
                ) : null
              ))}
            </div>
          )}

          {result?.evidence?.tables?.map((t, i) => (
            <details key={i} className="rounded border p-2">
              <summary className="cursor-pointer font-medium text-sm">{t.name}</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(t.rows, null, 2)}</pre>
            </details>
          ))}
          {result?.evidence?.sql && (
            <details className="rounded border p-2">
              <summary className="cursor-pointer font-medium text-sm">SQL used</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{result.evidence.sql}</pre>
            </details>
          )}
          {result?.evidence?.links && result.evidence.links.length > 0 && (
            <div className="rounded border p-2">
              <div className="font-medium text-sm">Links</div>
              <ul className="list-inside list-disc">
                {result.evidence.links.map((l, i) => (
                  <li key={i}><a className="text-blue-700 underline" href={l.href}>{l.label}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
