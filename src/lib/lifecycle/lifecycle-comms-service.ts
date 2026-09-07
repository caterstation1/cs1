import { prisma } from '@/lib/prisma'
import { DEFAULT_DAY_PRIOR_SENDER_PROFILES, SenderProfile } from '@/lib/order-notification-email'
import {
  DEFAULT_EMAIL_TYPE_CONFIG,
  DEFAULT_FALLBACK_HEADER_PATH,
  DEFAULT_REWARD_RULE_CONFIG,
  LIFECYCLE_COMMS_SETTINGS_KEY,
  LIFECYCLE_EMAIL_TYPES,
  LifecycleEmailType,
} from './constants'

export type LifecycleSettingsShape = {
  enabled: boolean
  liveMode: boolean
  automationEnabled: boolean
  bulkSendingEnabled: boolean
  requireAdminApproval: boolean
  testRecipientEmail: string | null
  selectedSenderKey: string | null
  senderProfiles: SenderProfile[]
  fallbackHeaderImagePath: string
  emailTypeConfig: Record<
    LifecycleEmailType,
    { enabled: boolean; subject: string; headerImagePath: string; bodyCopy?: string }
  >
  rewardRuleConfig: Record<string, any>
}

export async function ensureLifecycleCommsSettings() {
  const existing = await (prisma as any).lifecycleCommsSetting.findUnique({
    where: { key: LIFECYCLE_COMMS_SETTINGS_KEY },
  })
  if (existing) {
    if (!existing.liveMode) {
      return (prisma as any).lifecycleCommsSetting.update({
        where: { id: existing.id },
        data: { liveMode: true },
      })
    }
    return existing
  }

  return (prisma as any).lifecycleCommsSetting.create({
    data: {
      key: LIFECYCLE_COMMS_SETTINGS_KEY,
      title: 'Customer Lifecycle + Rewards',
      enabled: false,
      liveMode: true,
      automationEnabled: false,
      bulkSendingEnabled: false,
      requireAdminApproval: true,
      selectedSenderKey: DEFAULT_DAY_PRIOR_SENDER_PROFILES[1]?.key || DEFAULT_DAY_PRIOR_SENDER_PROFILES[0].key,
      senderProfiles: DEFAULT_DAY_PRIOR_SENDER_PROFILES as unknown as object,
      fallbackHeaderImagePath: DEFAULT_FALLBACK_HEADER_PATH,
      emailTypeConfig: DEFAULT_EMAIL_TYPE_CONFIG as unknown as object,
      rewardRuleConfig: DEFAULT_REWARD_RULE_CONFIG as unknown as object,
    },
  })
}

export function resolveLifecycleSenderProfile(settings: {
  selectedSenderKey?: string | null
  senderProfiles?: unknown
}): SenderProfile {
  const profilesRaw = Array.isArray(settings?.senderProfiles) ? settings.senderProfiles : DEFAULT_DAY_PRIOR_SENDER_PROFILES
  const selected =
    profilesRaw.find((p: any) => p?.key === settings?.selectedSenderKey) ||
    profilesRaw[0] ||
    DEFAULT_DAY_PRIOR_SENDER_PROFILES[0]
  return {
    key: String(selected.key || DEFAULT_DAY_PRIOR_SENDER_PROFILES[0].key),
    label: String(selected.label || 'Sender'),
    fromName: String(selected.fromName || 'Cater Station'),
    fromEmail: String(selected.fromEmail || process.env.EMAIL_USER || ''),
    replyTo: String(selected.replyTo || selected.fromEmail || process.env.EMAIL_USER || ''),
  }
}

export function normalizeLifecycleSettings(raw: any): LifecycleSettingsShape {
  const emailTypeConfigRaw =
    raw?.emailTypeConfig && typeof raw.emailTypeConfig === 'object' ? raw.emailTypeConfig : {}
  const emailTypeConfig = { ...DEFAULT_EMAIL_TYPE_CONFIG } as LifecycleSettingsShape['emailTypeConfig']
  for (const type of LIFECYCLE_EMAIL_TYPES) {
    const row = emailTypeConfigRaw[type]
    if (!row || typeof row !== 'object') continue
    emailTypeConfig[type] = {
      ...emailTypeConfig[type],
      enabled: typeof row.enabled === 'boolean' ? row.enabled : emailTypeConfig[type].enabled,
      subject: String(row.subject || emailTypeConfig[type].subject),
      headerImagePath: String(row.headerImagePath || emailTypeConfig[type].headerImagePath),
      bodyCopy: typeof row.bodyCopy === 'string' ? row.bodyCopy : emailTypeConfig[type].bodyCopy,
    }
  }

  const rewardRuleConfig =
    raw?.rewardRuleConfig && typeof raw.rewardRuleConfig === 'object'
      ? { ...DEFAULT_REWARD_RULE_CONFIG, ...raw.rewardRuleConfig }
      : { ...DEFAULT_REWARD_RULE_CONFIG }

  return {
    enabled: Boolean(raw?.enabled),
    liveMode: Boolean(raw?.liveMode),
    automationEnabled: Boolean(raw?.automationEnabled),
    bulkSendingEnabled: Boolean(raw?.bulkSendingEnabled),
    requireAdminApproval: raw?.requireAdminApproval !== false,
    testRecipientEmail: raw?.testRecipientEmail ? String(raw.testRecipientEmail) : null,
    selectedSenderKey: raw?.selectedSenderKey ? String(raw.selectedSenderKey) : null,
    senderProfiles: Array.isArray(raw?.senderProfiles) ? raw.senderProfiles : DEFAULT_DAY_PRIOR_SENDER_PROFILES,
    fallbackHeaderImagePath: String(raw?.fallbackHeaderImagePath || DEFAULT_FALLBACK_HEADER_PATH),
    emailTypeConfig,
    rewardRuleConfig,
  }
}

export function resolveLifecycleHeaderImagePath(
  settings: LifecycleSettingsShape,
  emailType: LifecycleEmailType
): string {
  return settings.emailTypeConfig[emailType]?.headerImagePath || settings.fallbackHeaderImagePath
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('//')
}

export function resolveLifecycleHeaderImageUrl(
  settings: LifecycleSettingsShape,
  emailType: LifecycleEmailType,
  appUrl: string
): string {
  const pathOrUrl = resolveLifecycleHeaderImagePath(settings, emailType)
  if (isAbsoluteUrl(pathOrUrl)) {
    return pathOrUrl.startsWith('//') ? `https:${pathOrUrl}` : pathOrUrl
  }
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${appUrl}${normalizedPath}`
}

export function lifecycleSubjectForType(settings: LifecycleSettingsShape, emailType: LifecycleEmailType): string {
  return settings.emailTypeConfig[emailType]?.subject || emailType
}
