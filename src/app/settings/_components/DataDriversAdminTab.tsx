'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Driver = {
  id: string
  fullName: string
  phone: string
  email?: string | null
  baseSuburb?: string | null
  status: string
  availability: boolean
  vehiclePhotoUrl?: string | null
  licencePhotoUrl?: string | null
  createdAt: string
  updatedAt: string
  applications?: Array<{ id: string; decision: string; submittedAt: string; adminNotes?: string | null }>
}

export default function DataDriversAdminTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Driver[]>([])
  const [loading, setLoading] = useState(false)
  const [openDriver, setOpenDriver] = useState<Driver | null>(null)
  const [saving, setSaving] = useState(false)
  // Quick WA tester
  const [waPhone, setWaPhone] = useState('')
  const [waText, setWaText] = useState('Test ping from CaterStation')
  const [waTemplateName, setWaTemplateName] = useState('delivery_confirmation_5')
  const [waUseTemplate, setWaUseTemplate] = useState(true)
  const [waResp, setWaResp] = useState<string>('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const res = await fetch(`/api/datadrivers?${params.toString()}`, { cache: 'no-store' })
      const data = res.ok ? await res.json() : []
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => { fetchRows() }, [fetchRows])

  const approve = async (id: string) => { await fetch(`/api/datadrivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) }); await fetchRows() }
  const reject = async (id: string) => { await fetch(`/api/datadrivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected' }) }); await fetchRows() }
  const suspend = async (id: string) => { await fetch(`/api/datadrivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'suspended' }) }); await fetchRows() }
  const archive = async (id: string) => { await fetch(`/api/datadrivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) }); await fetchRows() }
  const toggleAvailability = async (id: string, availability: boolean) => { await fetch(`/api/datadrivers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ availability }) }); await fetchRows() }
  const saveContact = async () => {
    if (!openDriver) return
    setSaving(true)
    try {
      await fetch(`/api/datadrivers/${openDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: openDriver.phone,
          email: openDriver.email || '',
          baseSuburb: openDriver.baseSuburb || '',
        }),
      })
      await fetchRows()
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      suspended: 'outline',
      archived: 'outline',
    }
    const variant = map[s] || 'secondary'
    return <Badge variant={variant}>{s}</Badge>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DataDrivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Search</Label>
              <Input className="w-60" placeholder="Name, phone, email, suburb" value={q} onChange={(e) => setQ(e.target.value)} />
              <Label className="text-sm ml-4">Status</Label>
              <Input className="w-40" placeholder="pending/active/..." value={status} onChange={(e) => setStatus(e.target.value)} />
              <Button onClick={fetchRows} className="ml-2">Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Quick Send (debug)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-sm">Phone</Label>
              <Input placeholder="021..." value={waPhone} onChange={(e) => setWaPhone(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Message</Label>
              <Input value={waText} onChange={(e) => setWaText(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Template Name</Label>
              <Input value={waTemplateName} onChange={(e) => setWaTemplateName(e.target.value)} />
              <div className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={waUseTemplate} onChange={(e) => setWaUseTemplate(e.target.checked)} />
                <span className="text-sm text-gray-600">Use template first</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={async () => {
              setWaResp('Sending...')
              const res = await fetch('/api/whatsapp/test-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: waPhone, text: waText, template: waUseTemplate, templateName: waTemplateName })
              })
              const txt = await res.text()
              setWaResp(txt)
            }}>
              Send
            </Button>
          </div>
          {waResp ? (
            <div className="mt-2">
              <Label className="text-sm">Response</Label>
              <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs overflow-x-auto whitespace-pre-wrap">{waResp}</pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Base Suburb</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-gray-500 p-6">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-gray-500 p-6">No drivers</TableCell></TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <button className="underline underline-offset-2" onClick={() => setOpenDriver(r)}>{r.fullName}</button>
                      </TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell>{r.email || '—'}</TableCell>
                      <TableCell>{r.baseSuburb || '—'}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        <Button variant={r.availability ? 'default' : 'outline'} size="sm" onClick={() => toggleAvailability(r.id, !r.availability)}>
                          {r.availability ? 'Available' : 'Off'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {r.status !== 'active' && <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>}
                          {r.status === 'pending' && <Button variant="outline" size="sm" onClick={() => reject(r.id)}>Reject</Button>}
                          {r.status === 'active' && <Button variant="outline" size="sm" onClick={() => suspend(r.id)}>Suspend</Button>}
                          {r.status !== 'archived' && <Button variant="destructive" size="sm" onClick={() => archive(r.id)}>Archive</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!openDriver} onOpenChange={(v) => !v && setOpenDriver(null)}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Driver — {openDriver?.fullName}</DialogTitle>
          </DialogHeader>
          {openDriver && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <Input
                    value={openDriver.phone}
                    onChange={(e) => setOpenDriver((d) => (d ? { ...d, phone: e.target.value } : d))}
                    placeholder="+6421..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <Input
                    value={openDriver.email || ''}
                    onChange={(e) => setOpenDriver((d) => (d ? { ...d, email: e.target.value } : d))}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Base Suburb</Label>
                  <Input
                    value={openDriver.baseSuburb || ''}
                    onChange={(e) => setOpenDriver((d) => (d ? { ...d, baseSuburb: e.target.value } : d))}
                    placeholder="Suburb"
                  />
                </div>
                <div><Label className="text-xs text-gray-500">Status</Label><div>{statusBadge(openDriver.status)}</div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {openDriver.vehiclePhotoUrl ? (
                  <div>
                    <Label className="text-xs text-gray-500">Vehicle Photo</Label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openDriver.vehiclePhotoUrl} alt="Vehicle" className="mt-1 rounded border object-cover w-full h-40" />
                  </div>
                ) : null}
                {openDriver.licencePhotoUrl ? (
                  <div>
                    <Label className="text-xs text-gray-500">Licence Photo</Label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openDriver.licencePhotoUrl} alt="Licence" className="mt-1 rounded border object-cover w-full h-40" />
                  </div>
                ) : null}
              </div>
              <div>
                <Label className="text-xs text-gray-500">Latest Application</Label>
                <div className="text-sm text-gray-700 mt-1">
                  {openDriver.applications?.[0]
                    ? `Submitted ${new Date(openDriver.applications[0].submittedAt).toLocaleString('en-NZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}. Notes: ${openDriver.applications[0].adminNotes || '—'}`
                    : '—'}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={saveContact} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Contact'}
                </Button>
                {openDriver.status !== 'active' && <Button onClick={() => approve(openDriver.id)}>Approve</Button>}
                {openDriver.status === 'pending' && <Button variant="outline" onClick={() => reject(openDriver.id)}>Reject</Button>}
                {openDriver.status === 'active' && <Button variant="outline" onClick={() => suspend(openDriver.id)}>Suspend</Button>}
                {openDriver.status !== 'archived' && <Button variant="destructive" onClick={() => archive(openDriver.id)}>Archive</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

