'use client'
import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function DriverJobInner() {
  const params = useSearchParams()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const token = params.get('token') || ''
  const [note, setNote] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (files: FileList | null) => {
    if (!files || !files[0]) return
    try {
      setUploading(true)
      const file = files[0]
      // reuse signed upload endpoint
      const folder = 'caterstation/delivery-proofs'
      const signRes = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) })
      if (!signRes.ok) throw new Error('Failed to get signature')
      const { cloudName, apiKey, timestamp, signature } = await signRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', apiKey)
      fd.append('timestamp', String(timestamp))
      fd.append('signature', signature)
      fd.append('folder', folder)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setProofUrl(data.secure_url)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const markDelivered = useCallback(async () => {
    if (!id || !token) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/dd/jobs/${id}/delivered?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveredNote: note, deliveredProofUrl: proofUrl || null }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to mark delivered')
      }
      router.replace(`/dd?token=${encodeURIComponent(token)}`)
    } catch (e: any) {
      setError(e?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }, [id, token, note, proofUrl, router])

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
        <CardHeader><CardTitle>Job #{id}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <div>
            <Label className="text-sm">Delivery note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Left at reception" />
          </div>
          <div>
            <Label className="text-sm">Proof photo (optional)</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => upload(e.target.files)} />
            {uploading ? <div className="text-xs text-gray-600 mt-1">Uploading…</div> : null}
            {proofUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofUrl} alt="Proof" className="mt-2 h-40 w-full object-cover rounded border" />
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button onClick={markDelivered} disabled={saving}>{saving ? 'Saving…' : 'Mark Delivered'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DriverJobPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <DriverJobInner />
    </Suspense>
  )
}

