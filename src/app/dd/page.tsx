'use client'
import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function DriverHomeInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dd/offers?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load offers')
      setRows(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const respond = async (offerId: string, action: 'accept' | 'decline') => {
    try {
      await fetch(`/api/dd/offers/${offerId}/respond?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await load()
    } catch {}
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Invalid Link</CardTitle></CardHeader>
          <CardContent>Please open this page from the link sent to you.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>DataDrivers — My Offers</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {rows.length === 0 && !loading ? <div className="text-sm text-gray-600">No offers at the moment.</div> : null}
          <div className="space-y-3">
            {rows.map((o) => (
              <div key={o.id} className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Job #{o.jobId}</div>
                  <Badge variant={o.status === 'offered' ? 'secondary' : 'default'}>{o.status}</Badge>
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  Payout: ${Number(o.deliveryJob?.payout || 0).toFixed(2)}
                </div>
                <div className="flex gap-2 mt-3">
                  {o.status === 'offered' && (
                    <>
                      <Button size="sm" onClick={() => respond(o.id, 'accept')}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => respond(o.id, 'decline')}>Decline</Button>
                    </>
                  )}
                  {o.status === 'accepted' && (
                    <Button size="sm" onClick={() => router.push(`/dd/job/${o.jobId}?token=${encodeURIComponent(token)}`)}>
                      Open Job
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DriverHomePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <DriverHomeInner />
    </Suspense>
  )
}

