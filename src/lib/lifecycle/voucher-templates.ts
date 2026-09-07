export const VOUCHER_EXPIRY_PRESET_OPTIONS = [
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '45', label: '45 days' },
  { value: '60', label: '60 days' },
  { value: 'other', label: 'Other' },
] as const

export type VoucherExpiryPreset = (typeof VOUCHER_EXPIRY_PRESET_OPTIONS)[number]['value']

export type VoucherTemplate = {
  voucherTemplateId: string
  label: string
  enabled: boolean
  /** Master Shopify discount code whose rules we copy (e.g. CSTATER2026). */
  shopifySourceCode: string
  /** Prefix used in the customer code emailed out (e.g. CSTATER2026-4829). */
  codePrefix: string
  expiryPreset: VoucherExpiryPreset
  expiryDays: number
  sortOrder: number
}

function normalizePreset(value: unknown, expiryDays: number): VoucherExpiryPreset {
  const preset = String(value || '').trim()
  if (preset === '14' || preset === '30' || preset === '45' || preset === '60' || preset === 'other') {
    return preset
  }
  if ([14, 30, 45, 60].includes(expiryDays)) {
    return String(expiryDays) as VoucherExpiryPreset
  }
  return 'other'
}

export function resolveVoucherExpiryDays(template: Pick<VoucherTemplate, 'expiryPreset' | 'expiryDays'>): number {
  if (template.expiryPreset !== 'other') {
    return Number(template.expiryPreset)
  }
  return Math.max(1, Number(template.expiryDays || 14))
}

export function parseVoucherTemplates(raw: unknown): VoucherTemplate[] {
  if (!Array.isArray(raw)) return []
  const rows: VoucherTemplate[] = []
  for (const row of raw as any[]) {
    const voucherTemplateId = String(row?.voucherTemplateId || '').trim()
    if (!voucherTemplateId) continue
    const shopifySourceCode = String(row?.shopifySourceCode || row?.codePrefix || '')
      .replace(/\s+/g, '')
      .toUpperCase()
    const codePrefix = String(row?.codePrefix || row?.shopifySourceCode || 'VOUCHER')
      .replace(/\s+/g, '')
      .toUpperCase()
    const expiryDays = Math.max(1, Number(row?.expiryDays || 14))
    rows.push({
      voucherTemplateId,
      label: String(row?.label || '').trim() || 'Untitled voucher',
      enabled: row?.enabled !== false,
      shopifySourceCode,
      codePrefix,
      expiryPreset: normalizePreset(row?.expiryPreset, expiryDays),
      expiryDays,
      sortOrder: Number(row?.sortOrder || 0),
    })
  }
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

export function getVoucherTemplate(
  templates: VoucherTemplate[],
  voucherTemplateId: string | null | undefined
): VoucherTemplate | null {
  const id = String(voucherTemplateId || '').trim()
  if (!id) return null
  return templates.find((row) => row.voucherTemplateId === id && row.enabled) || null
}

/** Customer-facing code emailed to the recipient, e.g. CSTATER2026-4829 */
export function generateVoucherCode(prefix: string): string {
  const suffix = String(Math.floor(1000 + Math.random() * 9000))
  return `${prefix}-${suffix}`
}

export function exampleVoucherCode(prefix: string): string {
  return `${prefix}-4829`
}
