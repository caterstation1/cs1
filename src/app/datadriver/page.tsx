'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export default function DataDriverLandingPage() {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    vehicleMake: '',
    vehicleModel: '',
    vehiclePlate: '',
    vehiclePhotoUrl: '',
    licencePhotoUrl: '',
    bankAccount: '',
    baseSuburb: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<{ licence: boolean; vehicle: boolean }>({ licence: false, vehicle: false })

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Signed upload via server-generated signature
  const uploadSigned = async (file: File, kind: 'vehicle' | 'licence') => {
    const baseFolder = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER || 'caterstation'
    const folder = `${baseFolder}/datadrivers/${kind === 'vehicle' ? 'vehicles' : 'licences'}`
    const signRes = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    })
    if (!signRes.ok) throw new Error('Failed to get upload signature')
    const { cloudName, apiKey, timestamp, signature } = await signRes.json()
    if (!cloudName || !apiKey || !signature || !timestamp) throw new Error('Invalid signature response')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', apiKey)
    fd.append('timestamp', String(timestamp))
    fd.append('signature', signature)
    fd.append('folder', folder)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json()
    return { publicId: data.public_id as string, url: data.secure_url as string }
  }

  const onLicenceSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      setUploading(u => ({ ...u, licence: true }))
      const file = files[0]
      const { url } = await uploadSigned(file, 'licence')
      setForm(prev => ({ ...prev, licencePhotoUrl: url }))
    } catch (e) {
      setError('Failed to upload licence image')
    } finally {
      setUploading(u => ({ ...u, licence: false }))
    }
  }

  const onVehicleSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      setUploading(u => ({ ...u, vehicle: true }))
      const file = files[0]
      const { url } = await uploadSigned(file, 'vehicle')
      setForm(prev => ({ ...prev, vehiclePhotoUrl: url }))
    } catch (e) {
      setError('Failed to upload vehicle image')
    } finally {
      setUploading(u => ({ ...u, vehicle: false }))
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/datadrivers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to submit')
      }
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-height-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Thanks for applying!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              We’ve received your application. Our team will review your details and contact you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Apply to be a DataDriver</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" value={form.fullName} onChange={onChange} placeholder="First Last" />
            </div>
            <div>
              <Label htmlFor="phone">Phone (mobile)</Label>
              <Input id="phone" name="phone" value={form.phone} onChange={onChange} placeholder="+64..." />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" value={form.email} onChange={onChange} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="baseSuburb">Base suburb</Label>
              <Input id="baseSuburb" name="baseSuburb" value={form.baseSuburb} onChange={onChange} placeholder="e.g. Mount Eden" />
            </div>
            <div>
              <Label htmlFor="vehicleMake">Vehicle make</Label>
              <Input id="vehicleMake" name="vehicleMake" value={form.vehicleMake} onChange={onChange} placeholder="e.g. Toyota" />
            </div>
            <div>
              <Label htmlFor="vehicleModel">Vehicle model</Label>
              <Input id="vehicleModel" name="vehicleModel" value={form.vehicleModel} onChange={onChange} placeholder="e.g. Hiace" />
            </div>
            <div>
              <Label htmlFor="vehiclePlate">Vehicle plate</Label>
              <Input id="vehiclePlate" name="vehiclePlate" value={form.vehiclePlate} onChange={onChange} placeholder="ABC123" />
            </div>
            <div>
              <Label htmlFor="bankAccount">Bank account</Label>
              <Input id="bankAccount" name="bankAccount" value={form.bankAccount} onChange={onChange} placeholder="00-0000-0000000-00" />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Vehicle photo (optional)</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={(e) => onVehicleSelected(e.target.files)} />
                {uploading.vehicle && <div className="text-xs text-gray-500 mt-1">Uploading…</div>}
                {form.vehiclePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.vehiclePhotoUrl} alt="Vehicle" className="mt-2 h-28 w-full object-cover rounded border" />
                ) : null}
              </div>
              <div>
                <Label>Driver licence photo (optional)</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={(e) => onLicenceSelected(e.target.files)} />
                {uploading.licence && <div className="text-xs text-gray-500 mt-1">Uploading…</div>}
                {form.licencePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.licencePhotoUrl} alt="Licence" className="mt-2 h-28 w-full object-cover rounded border" />
                ) : null}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" value={form.notes} onChange={onChange} placeholder="Tell us about your experience or availability..." rows={4} />
            </div>
          </div>
          {error && <div className="text-red-600 text-sm mt-4">{error}</div>}
          <div className="flex justify-end mt-6">
            <Button onClick={submit} disabled={submitting || !form.fullName || !form.phone}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

