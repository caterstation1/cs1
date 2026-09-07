import { prisma } from '@/lib/prisma'
import { DEFAULT_DAY_PRIOR_SENDER_PROFILES, SenderProfile } from '@/lib/order-notification-email'

export const FULFILLMENT_COMMS_SETTINGS_KEY = 'FULFILLMENT_COMMS'

export type FulfillmentTriggerMetric = 'orders' | 'spent'

export interface FulfillmentTriggerRule {
  id: string
  metric: FulfillmentTriggerMetric
  threshold: number
  suggestedRebate: string
}

export async function ensureFulfillmentCommsSettings() {
  const existing = await prisma.fulfillmentCommsSetting.findUnique({
    where: { key: FULFILLMENT_COMMS_SETTINGS_KEY },
  })
  if (existing) return existing

  return prisma.fulfillmentCommsSetting.create({
    data: {
      key: FULFILLMENT_COMMS_SETTINGS_KEY,
      title: 'Fulfillment confirmation & milestone alerts',
      enabled: true,
      triggerRules: [] as unknown as object,
      recentWindowDays: 7,
      selectedSenderKey: DEFAULT_DAY_PRIOR_SENDER_PROFILES[0].key,
      senderProfiles: DEFAULT_DAY_PRIOR_SENDER_PROFILES as object,
      liveMode: false,
    },
  })
}

export function resolveFulfillmentSenderProfile(settings: {
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

export function parseFulfillmentDefaultBodyCopy(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return []
  const s = String(raw).trim()
  try {
    const j = JSON.parse(s)
    if (Array.isArray(j)) return j.map((x) => String(x || '').trim()).filter(Boolean)
  } catch {
    /* newline-separated */
  }
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function normalizeTriggerRules(raw: unknown): FulfillmentTriggerRule[] {
  if (!Array.isArray(raw)) return []
  const out: FulfillmentTriggerRule[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = String(o.id || '').trim() || `rule_${Math.random().toString(36).slice(2, 9)}`
    const metric = o.metric === 'spent' ? 'spent' : 'orders'
    const threshold = Number(o.threshold)
    if (!Number.isFinite(threshold) || threshold < 0) continue
    out.push({
      id,
      metric,
      threshold,
      suggestedRebate: String(o.suggestedRebate || '').trim(),
    })
  }
  return out
}
