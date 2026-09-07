import { LIFECYCLE_EMAIL_TYPES, type LifecycleEmailType } from './constants'

export type CustomEmailTemplate = {
  templateId: string
  templateName: string
  baseEmailType: LifecycleEmailType
  subject: string
  bodyCopy?: string
  headerImagePath: string
  enabled: boolean
}

export type EmailTemplateSelection =
  | {
      kind: 'system'
      key: string
      emailType: LifecycleEmailType
      customTemplate: null
    }
  | {
      kind: 'custom'
      key: string
      emailType: LifecycleEmailType
      customTemplate: CustomEmailTemplate
    }

export function isLifecycleEmailType(value: string): value is LifecycleEmailType {
  return (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value)
}

export function customTemplateKey(templateId: string): string {
  return `custom:${templateId}`
}

export function systemTemplateKey(emailType: LifecycleEmailType): string {
  return `system:${emailType}`
}

export function parseCustomEmailTemplates(raw: unknown): CustomEmailTemplate[] {
  if (!Array.isArray(raw)) return []
  const rows: CustomEmailTemplate[] = []
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

export function resolveEmailTemplateSelection(input: {
  value?: string | null
  customTemplates: CustomEmailTemplate[]
  fallbackEmailType?: LifecycleEmailType
}): EmailTemplateSelection {
  const fallback = input.fallbackEmailType || 'FIRST_ORDER_POST_PURCHASE'
  const raw = String(input.value || '').trim()

  if (raw.startsWith('custom:')) {
    const templateId = raw.slice('custom:'.length)
    const customTemplate = input.customTemplates.find((row) => row.templateId === templateId && row.enabled)
    if (customTemplate) {
      return {
        kind: 'custom',
        key: raw,
        emailType: customTemplate.baseEmailType,
        customTemplate,
      }
    }
  }

  if (raw.startsWith('system:')) {
    const emailType = raw.slice('system:'.length)
    if (isLifecycleEmailType(emailType)) {
      return { kind: 'system', key: raw, emailType, customTemplate: null }
    }
  }

  if (isLifecycleEmailType(raw)) {
    return { kind: 'system', key: raw, emailType: raw, customTemplate: null }
  }

  const stored = String(input.value || '').trim()
  if (stored.startsWith('custom:')) {
    const templateId = stored.slice('custom:'.length)
    const customTemplate = input.customTemplates.find((row) => row.templateId === templateId)
    if (customTemplate) {
      return {
        kind: 'custom',
        key: stored,
        emailType: customTemplate.baseEmailType,
        customTemplate,
      }
    }
  }

  return { kind: 'system', key: fallback, emailType: fallback, customTemplate: null }
}

export function formatEmailTemplateLabel(
  selectionKey: string,
  customTemplates: CustomEmailTemplate[]
): string {
  if (selectionKey.startsWith('custom:')) {
    const templateId = selectionKey.slice('custom:'.length)
    const custom = customTemplates.find((row) => row.templateId === templateId)
    return custom ? `${custom.templateName} (Custom)` : 'Custom template'
  }
  const emailType = selectionKey.startsWith('system:')
    ? selectionKey.slice('system:'.length)
    : selectionKey
  if (isLifecycleEmailType(emailType)) {
    return emailType
      .replace('_POST_PURCHASE', '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase())
  }
  return selectionKey
}

export function resolveCustomHeaderImageUrl(headerImagePath: string, appUrl: string): string | undefined {
  const pathOrUrl = String(headerImagePath || '').trim()
  if (!pathOrUrl) return undefined
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('//')) {
    return pathOrUrl.startsWith('//') ? `https:${pathOrUrl}` : pathOrUrl
  }
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${appUrl}${normalizedPath}`
}
