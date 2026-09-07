import {
  parseCustomEmailTemplates,
  resolveCustomHeaderImageUrl,
  resolveEmailTemplateSelection,
  type EmailTemplateSelection,
} from '@/lib/lifecycle/custom-email-templates'
import { ensureLifecycleCommsSettings, normalizeLifecycleSettings } from '@/lib/lifecycle/lifecycle-comms-service'
import { getAppUrl } from '@/lib/order-notification-email'

export async function resolveStoredEmailTemplateSelection(input: {
  value?: string | null
}): Promise<EmailTemplateSelection> {
  const settings = normalizeLifecycleSettings(await ensureLifecycleCommsSettings())
  const customTemplates = parseCustomEmailTemplates(settings.rewardRuleConfig?.customTemplates)
  return resolveEmailTemplateSelection({
    value: input.value,
    customTemplates,
  })
}

export function customTemplateSendOverrides(selection: EmailTemplateSelection): {
  subject?: string
  bodyCopy?: string
  headerImageUrl?: string
} {
  if (selection.kind !== 'custom' || !selection.customTemplate) {
    return {}
  }
  const appUrl = getAppUrl()
  return {
    subject: selection.customTemplate.subject || undefined,
    bodyCopy: selection.customTemplate.bodyCopy || undefined,
    headerImageUrl: resolveCustomHeaderImageUrl(selection.customTemplate.headerImagePath, appUrl),
  }
}

export function emailTemplateStorageKey(selection: EmailTemplateSelection): string {
  return selection.key
}
