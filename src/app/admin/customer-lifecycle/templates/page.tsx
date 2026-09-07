'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LIFECYCLE_EMAIL_TYPES, type LifecycleEmailType } from '@/lib/lifecycle/constants'
import { parseVoucherTemplates, VOUCHER_EXPIRY_PRESET_OPTIONS, exampleVoucherCode, type VoucherTemplate } from '@/lib/lifecycle/voucher-templates'

type CustomTemplate = {
  templateId: string
  templateName: string
  baseEmailType: LifecycleEmailType
  subject: string
  bodyCopy?: string
  headerImagePath: string
  enabled: boolean
}

type TemplateSettings = {
  rewardRuleConfig?: {
    reviewUrl?: string
    feedbackUrl?: string
    reorderUrl?: string
    customTemplates?: CustomTemplate[]
    [key: string]: unknown
  }
  emailTypeConfig: Record<
    LifecycleEmailType,
    {
      enabled: boolean
      subject: string
      headerImagePath: string
      bodyCopy?: string
    }
  >
}

type SelectedTemplateRef =
  | { kind: 'system'; emailType: LifecycleEmailType }
  | { kind: 'custom'; templateId: string }

type SuggestionRow = {
  suggestionId: string
  companyId: string
  companyName: string
  contactId?: string | null
  contactName?: string | null
  contactEmail?: string | null
  suggestedEmailType: LifecycleEmailType
}

const MERGE_VARIANTS: Array<{ token: string; internal: string; description: string }> = [
  { token: '[customer-name]', internal: '{{customerFirstName}}', description: 'Primary contact first name' },
  { token: '[company-name]', internal: '{{companyName}}', description: 'Company name' },
  { token: '[order-name]', internal: '{{orderName}}', description: 'Order label/name' },
  { token: '[order-number]', internal: '{{orderNumber}}', description: 'Order number' },
  { token: '[order-date]', internal: '{{orderDate}}', description: 'Order date' },
  { token: '[delivery-date]', internal: '{{deliveryDate}}', description: 'Delivery date' },
  { token: '[products-ordered]', internal: '{{productsOrdered}}', description: 'Products summary' },
  { token: '[total-spend]', internal: '{{totalSpend}}', description: 'Company total spend' },
  { token: '[company-order-count]', internal: '{{companyOrderCount}}', description: 'Company order count' },
  { token: '[reward-name]', internal: '{{rewardName}}', description: 'Reward name' },
  { token: '[reward-code]', internal: '{{rewardCode}}', description: 'Reward code' },
  { token: '[reward-expiry-date]', internal: '{{rewardExpiryDate}}', description: 'Reward expiry date' },
  { token: '[review-url]', internal: '{{reviewUrl}}', description: 'Review CTA URL' },
  { token: '[feedback-url]', internal: '{{feedbackUrl}}', description: 'Feedback CTA URL' },
  { token: '[reorder-url]', internal: '{{reorderUrl}}', description: 'Reorder CTA URL' },
]

function prettyEmailType(value: LifecycleEmailType): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
}

function isLifecycleEmailType(value: string): value is LifecycleEmailType {
  return (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value)
}

function parseSelectedTemplate(value: string): SelectedTemplateRef {
  if (value.startsWith('custom:')) {
    return { kind: 'custom', templateId: value.slice('custom:'.length) }
  }
  const emailType = value.slice('system:'.length)
  if (isLifecycleEmailType(emailType)) {
    return { kind: 'system', emailType }
  }
  return { kind: 'system', emailType: LIFECYCLE_EMAIL_TYPES[0] }
}

function templateKeyOf(ref: SelectedTemplateRef): string {
  return ref.kind === 'system' ? `system:${ref.emailType}` : `custom:${ref.templateId}`
}

function looksLikeHtml(input: string): boolean {
  return /<\s*[a-z][^>]*>/i.test(input)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToEditorHtml(input: string): string {
  return escapeHtml(input).replace(/\n/g, '<br>')
}

function parseCustomTemplates(raw: unknown): CustomTemplate[] {
  if (!Array.isArray(raw)) return []
  const rows: CustomTemplate[] = []
  for (const row of raw as any[]) {
    const baseEmailType = String(row?.baseEmailType || '')
    if (!isLifecycleEmailType(baseEmailType)) continue
    const templateId = String(row?.templateId || '').trim()
    if (!templateId) continue
    rows.push({
      templateId,
      templateName: String(row?.templateName || '').trim() || 'Untitled template',
      baseEmailType,
      subject: String(row?.subject || ''),
      bodyCopy: typeof row?.bodyCopy === 'string' ? row.bodyCopy : '',
      headerImagePath: String(row?.headerImagePath || ''),
      enabled: row?.enabled !== false,
    })
  }
  return rows
}

export default function LifecycleTemplateEditorPage() {
  const [settings, setSettings] = useState<TemplateSettings | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplateRef>({
    kind: 'system',
    emailType: LIFECYCLE_EMAIL_TYPES[0],
  })
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [voucherTemplates, setVoucherTemplates] = useState<VoucherTemplate[]>([])
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string>('')
  const [templateName, setTemplateName] = useState('')
  const [baseEmailType, setBaseEmailType] = useState<LifecycleEmailType>(LIFECYCLE_EMAIL_TYPES[0])
  const [subject, setSubject] = useState('')
  const [bodyCopy, setBodyCopy] = useState('')
  const [headerImagePath, setHeaderImagePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [reviewUrl, setReviewUrl] = useState('')
  const editorRef = useRef<HTMLDivElement | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const [templatesRes, suggestionsRes] = await Promise.all([
        fetch('/api/admin/customer-lifecycle/templates', { cache: 'no-store' }),
        fetch('/api/admin/customer-lifecycle/suggestions?limit=300', { cache: 'no-store' }),
      ])
      const [templatesJson, suggestionsJson] = await Promise.all([templatesRes.json(), suggestionsRes.json()])
      if (templatesJson?.success) {
        setSettings(templatesJson.settings)
        const parsedCustom = parseCustomTemplates(templatesJson.settings?.rewardRuleConfig?.customTemplates)
        setCustomTemplates(parsedCustom)
        setVoucherTemplates(parseVoucherTemplates(templatesJson.settings?.rewardRuleConfig?.voucherTemplates))
        setReviewUrl(String(templatesJson.settings?.rewardRuleConfig?.reviewUrl || ''))
      }
      if (suggestionsJson?.success) {
        const rows = (suggestionsJson.rows || []) as SuggestionRow[]
        setSuggestions(rows)
        if (!selectedSuggestionId && rows.length > 0) {
          setSelectedSuggestionId(rows[0].suggestionId)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [selectedSuggestionId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedTemplateKey = templateKeyOf(selectedTemplate)

  const selectedCustomTemplate = useMemo(
    () => (selectedTemplate.kind === 'custom' ? customTemplates.find((t) => t.templateId === selectedTemplate.templateId) || null : null),
    [selectedTemplate, customTemplates]
  )

  useEffect(() => {
    if (!settings) return
    if (selectedTemplate.kind === 'system') {
      const current = settings.emailTypeConfig[selectedTemplate.emailType]
      setTemplateName(prettyEmailType(selectedTemplate.emailType))
      setBaseEmailType(selectedTemplate.emailType)
      setSubject(current?.subject || '')
      setBodyCopy(current?.bodyCopy || '')
      setHeaderImagePath(current?.headerImagePath || '')
      return
    }
    const current = customTemplates.find((row) => row.templateId === selectedTemplate.templateId)
    if (!current) {
      setSelectedTemplate({ kind: 'system', emailType: LIFECYCLE_EMAIL_TYPES[0] })
      return
    }
    setTemplateName(current.templateName)
    setBaseEmailType(current.baseEmailType)
    setSubject(current.subject || '')
    setBodyCopy(current.bodyCopy || '')
    setHeaderImagePath(current.headerImagePath || '')
  }, [settings, customTemplates, selectedTemplate])

  const syncEditorFromBody = useCallback((nextBody: string) => {
    const editor = editorRef.current
    if (!editor) return
    const html = looksLikeHtml(nextBody) ? nextBody : textToEditorHtml(nextBody)
    if (editor.innerHTML !== html) {
      editor.innerHTML = html || ''
    }
  }, [])

  useEffect(() => {
    syncEditorFromBody(bodyCopy)
  }, [bodyCopy, syncEditorFromBody])

  const selectedSuggestion = useMemo(
    () => suggestions.find((row) => row.suggestionId === selectedSuggestionId) || null,
    [suggestions, selectedSuggestionId]
  )

  const saveTemplate = async () => {
    if (!settings) return
    setSaving(true)
    setMessage('')
    try {
      const nextEmailTypeConfig = { ...settings.emailTypeConfig }
      let nextCustomTemplates = [...customTemplates]
      if (selectedTemplate.kind === 'system') {
        nextEmailTypeConfig[selectedTemplate.emailType] = {
          ...settings.emailTypeConfig[selectedTemplate.emailType],
          subject: subject.trim(),
          bodyCopy,
          headerImagePath: headerImagePath.trim(),
        }
      } else {
        const nextRow: CustomTemplate = {
          templateId: selectedTemplate.templateId,
          templateName: templateName.trim() || 'Untitled template',
          baseEmailType,
          subject: subject.trim(),
          bodyCopy,
          headerImagePath: headerImagePath.trim(),
          enabled: true,
        }
        const idx = nextCustomTemplates.findIndex((row) => row.templateId === selectedTemplate.templateId)
        if (idx >= 0) nextCustomTemplates[idx] = nextRow
        else nextCustomTemplates.unshift(nextRow)
      }
      const res = await fetch('/api/admin/customer-lifecycle/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailTypeConfig: nextEmailTypeConfig,
          rewardRuleConfig: {
            ...(settings.rewardRuleConfig || {}),
            reviewUrl: reviewUrl.trim(),
            customTemplates: nextCustomTemplates,
            voucherTemplates,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setMessage(`Save failed: ${json?.error || 'Unknown error'}`)
        return
      }
      setSettings(json.settings)
      setCustomTemplates(parseCustomTemplates(json.settings?.rewardRuleConfig?.customTemplates))
      setVoucherTemplates(parseVoucherTemplates(json.settings?.rewardRuleConfig?.voucherTemplates))
      setMessage('Template saved.')
    } finally {
      setSaving(false)
    }
  }

  const addVoucherTemplate = () => {
    setVoucherTemplates((prev) => [
      {
        voucherTemplateId: `voucher_${Date.now()}`,
        label: 'Tatertots hurry voucher',
        enabled: true,
        shopifySourceCode: 'CSTATER2026',
        codePrefix: 'CSTATER2026',
        expiryPreset: '14',
        expiryDays: 14,
        sortOrder: prev.length,
      },
      ...prev,
    ])
    setMessage('Voucher template draft added. Save to persist.')
  }

  const updateVoucherTemplate = (voucherTemplateId: string, patch: Partial<VoucherTemplate>) => {
    setVoucherTemplates((prev) =>
      prev.map((row) => (row.voucherTemplateId === voucherTemplateId ? { ...row, ...patch } : row))
    )
  }

  const removeVoucherTemplate = (voucherTemplateId: string) => {
    setVoucherTemplates((prev) => prev.filter((row) => row.voucherTemplateId !== voucherTemplateId))
    setMessage('Voucher template removed from editor. Save to persist deletion.')
  }

  const saveVoucherTemplates = async () => {
    if (!settings) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/customer-lifecycle/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rewardRuleConfig: {
            ...(settings.rewardRuleConfig || {}),
            voucherTemplates,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setMessage(`Save failed: ${json?.error || 'Unknown error'}`)
        return
      }
      setSettings(json.settings)
      setVoucherTemplates(parseVoucherTemplates(json.settings?.rewardRuleConfig?.voucherTemplates))
      setMessage('Voucher templates saved.')
    } finally {
      setSaving(false)
    }
  }

  const addNewTemplate = () => {
    const templateId = `custom_${Date.now()}`
    const newTemplate: CustomTemplate = {
      templateId,
      templateName: 'New template',
      baseEmailType:
        selectedTemplate.kind === 'system'
          ? selectedTemplate.emailType
          : selectedCustomTemplate?.baseEmailType || LIFECYCLE_EMAIL_TYPES[0],
      subject,
      bodyCopy,
      headerImagePath,
      enabled: true,
    }
    setCustomTemplates((prev) => [newTemplate, ...prev])
    setSelectedTemplate({ kind: 'custom', templateId })
    setTemplateName(newTemplate.templateName)
    setBaseEmailType(newTemplate.baseEmailType)
    setMessage('New template draft added. Save to persist.')
  }

  const duplicateTemplate = () => {
    const templateId = `custom_${Date.now()}`
    const newTemplate: CustomTemplate = {
      templateId,
      templateName: `${templateName.trim() || 'Untitled template'} (copy)`,
      baseEmailType,
      subject,
      bodyCopy,
      headerImagePath,
      enabled: true,
    }
    setCustomTemplates((prev) => [newTemplate, ...prev])
    setSelectedTemplate({ kind: 'custom', templateId })
    setMessage('Template duplicated as a draft. Save to persist.')
  }

  const deleteCustomTemplate = async () => {
    if (selectedTemplate.kind !== 'custom' || !settings) return
    const target = customTemplates.find((row) => row.templateId === selectedTemplate.templateId)
    const ok = window.confirm(`Delete template "${target?.templateName || 'this template'}"? This cannot be undone.`)
    if (!ok) return
    setSaving(true)
    setMessage('')
    try {
      const nextCustomTemplates = customTemplates.filter((row) => row.templateId !== selectedTemplate.templateId)
      const res = await fetch('/api/admin/customer-lifecycle/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rewardRuleConfig: {
            ...(settings.rewardRuleConfig || {}),
            customTemplates: nextCustomTemplates,
            voucherTemplates,
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setMessage(`Delete failed: ${json?.error || 'Unknown error'}`)
        return
      }
      setSettings(json.settings)
      setCustomTemplates(parseCustomTemplates(json.settings?.rewardRuleConfig?.customTemplates))
      setVoucherTemplates(parseVoucherTemplates(json.settings?.rewardRuleConfig?.voucherTemplates))
      setSelectedTemplate({ kind: 'system', emailType: LIFECYCLE_EMAIL_TYPES[0] })
      setMessage('Template deleted.')
    } finally {
      setSaving(false)
    }
  }

  const runEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
    setBodyCopy(editorRef.current.innerHTML)
  }

  const insertLink = () => {
    const url = window.prompt('Enter URL for this link')
    if (!url) return
    runEditorCommand('createLink', url.trim())
  }

  const uploadHeaderImage = async (file: File) => {
    setUploading(true)
    setMessage('')
    try {
      const baseFolder = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER || 'caterstation'
      const folder = `${baseFolder}/email-headers/lifecycle`
      const signRes = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      if (!signRes.ok) {
        setMessage('Upload signing failed.')
        return
      }
      const sign = await signRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('api_key', String(sign.apiKey || ''))
      fd.append('timestamp', String(sign.timestamp || ''))
      fd.append('signature', String(sign.signature || ''))
      fd.append('folder', folder)
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
        method: 'POST',
        body: fd,
      })
      if (!uploadRes.ok) {
        setMessage('Header image upload failed.')
        return
      }
      const uploaded = await uploadRes.json()
      const secureUrl = String(uploaded?.secure_url || '').trim()
      if (!secureUrl) {
        setMessage('Header image upload returned no URL.')
        return
      }
      setHeaderImagePath(secureUrl)
      setMessage('Header uploaded. Save template to persist.')
    } finally {
      setUploading(false)
    }
  }

  const openPreview = () => {
    if (!selectedSuggestion?.companyId) {
      setMessage('Select a preview context row first.')
      return
    }
    const previewEmailType =
      selectedTemplate.kind === 'system' ? selectedTemplate.emailType : baseEmailType
    const params = new URLSearchParams({
      companyId: selectedSuggestion.companyId,
      emailType: previewEmailType,
      ...(selectedSuggestion.contactId ? { contactId: selectedSuggestion.contactId } : {}),
      ...(subject.trim() ? { subject: subject.trim() } : {}),
      ...(bodyCopy.trim() ? { bodyCopy } : {}),
      ...(headerImagePath.trim() ? { headerImageUrl: headerImagePath.trim() } : {}),
      ...(reviewUrl.trim() ? { reviewUrl: reviewUrl.trim() } : {}),
    })
    window.open(`/api/admin/customer-lifecycle/preview?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="dashboard-page container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Lifecycle Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Edit template copy, upload banner image URLs to DB settings, and preview before sending.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to AdminS</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/customer-lifecycle">Lifecycle Queue</Link>
          </Button>
        </div>
      </div>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Template Editor</CardTitle>
          <CardDescription>Select template, edit fields, upload header, save, and preview.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Template</Label>
              <div className="mt-1 flex gap-2">
                <Select value={selectedTemplateKey} onValueChange={(value) => setSelectedTemplate(parseSelectedTemplate(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {LIFECYCLE_EMAIL_TYPES.map((type) => (
                      <SelectItem key={`system:${type}`} value={`system:${type}`}>
                        {prettyEmailType(type)} (System)
                      </SelectItem>
                    ))}
                    {customTemplates.map((template) => (
                      <SelectItem key={`custom:${template.templateId}`} value={`custom:${template.templateId}`}>
                        {template.templateName} (Custom)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addNewTemplate}>
                  Add New Template
                </Button>
              </div>
            </div>

            <div>
              <Label>Preview Context (real company/contact)</Label>
              <Select value={selectedSuggestionId} onValueChange={setSelectedSuggestionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {suggestions.map((row) => (
                    <SelectItem key={row.suggestionId} value={row.suggestionId}>
                      {row.companyName} - {row.contactName || row.contactEmail || 'No contact'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTemplate.kind === 'custom' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Template Name</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Base Email Type</Label>
                <Select value={baseEmailType} onValueChange={(value) => setBaseEmailType(value as LifecycleEmailType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_EMAIL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {prettyEmailType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
          ) : null}

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Body Copy</Label>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('bold')}>
                  B
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('italic')}>
                  I
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('underline')}>
                  U
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('insertUnorderedList')}>
                  Bullet
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('insertOrderedList')}>
                  Numbered
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('formatBlock', 'blockquote')}>
                  Quote
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={insertLink}>
                  Link
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand('removeFormat')}>
                  Clear
                </Button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                onInput={(e) => setBodyCopy((e.currentTarget as HTMLDivElement).innerHTML)}
              />
              <p className="text-xs text-muted-foreground">
                Standard rich formatting supported. Merge variants like <code>[customer-name]</code> also work.
                For voucher lines use <code>Use code: [reward-code]</code> and{' '}
                <code>(valid until [reward-expiry-date])</code> — the grey code box at the bottom is only added when
                those placeholders are missing.
              </p>
            </div>
          </div>

          <div>
            <Label>Google Review Link (global CTA)</Label>
            <Input
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              className="mt-1"
              placeholder="https://g.page/r/....../review"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This powers the "★★★★★ Leave a review" hyperlink CTA in lifecycle emails.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Header Image URL / Path</Label>
            <Input
              value={headerImagePath}
              onChange={(e) => setHeaderImagePath(e.target.value)}
              className="mt-1"
              placeholder="/email-headers/first-order-post-purchase.jpg or https://..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor="header-upload-input"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Header
              </Label>
              <input
                id="header-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    void uploadHeaderImage(file)
                  }
                  e.currentTarget.value = ''
                }}
              />
              <Button variant="outline" onClick={openPreview} disabled={loading || !selectedSuggestion}>
                Preview
              </Button>
              <Button onClick={saveTemplate} disabled={saving || uploading || !settings}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Template
              </Button>
              <Button variant="outline" onClick={duplicateTemplate} disabled={!settings}>
                Duplicate
              </Button>
              {selectedTemplate.kind === 'custom' ? (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => void deleteCustomTemplate()}
                  disabled={saving}
                >
                  Delete Template
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
            {headerImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerImagePath} alt="Template banner preview" className="max-h-40 rounded border object-cover" />
            ) : null}
          </div>
          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Voucher Templates</CardTitle>
          <CardDescription>
            Link to a master Shopify discount code (e.g. CSTATER2026). On live send we clone that discount for the
            customer, generate a code like {exampleVoucherCode('CSTATER2026')}, and set the use-by date here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addVoucherTemplate}>
              Add Voucher Template
            </Button>
            <Button onClick={saveVoucherTemplates} disabled={saving || !settings}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Voucher Templates
            </Button>
          </div>
          {voucherTemplates.length ? (
            <div className="space-y-3">
              {voucherTemplates.map((voucher) => (
                <div key={voucher.voucherTemplateId} className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-2">
                  <div>
                    <Label>Label (internal)</Label>
                    <Input
                      value={voucher.label}
                      onChange={(e) => updateVoucherTemplate(voucher.voucherTemplateId, { label: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Shopify source discount code</Label>
                    <Input
                      value={voucher.shopifySourceCode}
                      onChange={(e) =>
                        updateVoucherTemplate(voucher.voucherTemplateId, {
                          shopifySourceCode: e.target.value.replace(/\s+/g, '').toUpperCase(),
                        })
                      }
                      className="mt-1"
                      placeholder="CSTATER2026"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Master discount in Shopify Admin whose rules we copy.
                    </p>
                  </div>
                  <div>
                    <Label>Code prefix (emailed to customer)</Label>
                    <Input
                      value={voucher.codePrefix}
                      onChange={(e) =>
                        updateVoucherTemplate(voucher.voucherTemplateId, {
                          codePrefix: e.target.value.replace(/\s+/g, '').toUpperCase(),
                        })
                      }
                      className="mt-1"
                      placeholder="CSTATER2026"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Example emailed code: {exampleVoucherCode(voucher.codePrefix || 'PREFIX')}
                    </p>
                  </div>
                  <div>
                    <Label>Use by</Label>
                    <Select
                      value={voucher.expiryPreset}
                      onValueChange={(value) =>
                        updateVoucherTemplate(voucher.voucherTemplateId, {
                          expiryPreset: value as VoucherTemplate['expiryPreset'],
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {VOUCHER_EXPIRY_PRESET_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {voucher.expiryPreset === 'other' ? (
                    <div>
                      <Label>Custom use-by (days)</Label>
                      <Input
                        type="number"
                        value={voucher.expiryDays}
                        onChange={(e) =>
                          updateVoucherTemplate(voucher.voucherTemplateId, {
                            expiryDays: Math.max(1, Number(e.target.value || 14)),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-end justify-between gap-2 md:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={voucher.enabled}
                        onChange={(e) =>
                          updateVoucherTemplate(voucher.voucherTemplateId, { enabled: e.target.checked })
                        }
                      />
                      Enabled in post-purchase queue
                    </label>
                    <Button type="button" variant="outline" onClick={() => removeVoucherTemplate(voucher.voucherTemplateId)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No voucher templates yet. Add one for hurry-along 2nd-order offers (e.g. $20 off, 14-day expiry).
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Merge Variants + Formatting</CardTitle>
          <CardDescription>
            You can use square-bracket variants (recommended) or existing double-curly variants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {MERGE_VARIANTS.map((item) => (
            <div key={item.token} className="flex flex-col gap-0.5 rounded border p-2 md:flex-row md:items-center md:gap-3">
              <code>{item.token}</code>
              <span className="text-muted-foreground">{item.description}</span>
              <code className="md:ml-auto">{item.internal}</code>
            </div>
          ))}
          <div className="rounded border p-2">
            <div className="font-medium">Formatting helpers</div>
            <div className="text-muted-foreground">
              You can format with the toolbar (bold/italic/underline/lists/quote/link). Underline shortcuts also work:
              <code> [u]text[/u] </code> or <code>__text__</code>.
            </div>
            <div className="text-muted-foreground">
              Multiple blank lines are now preserved in the rendered email preview/send.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
