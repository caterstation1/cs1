import { prisma } from '@/lib/prisma'
import { buildTransporter } from '@/lib/day-prior-notification-service'
import { getAppUrl } from '@/lib/order-notification-email'
import { LifecycleEmailType } from './constants'
import {
  ensureLifecycleCommsSettings,
  lifecycleSubjectForType,
  normalizeLifecycleSettings,
  resolveLifecycleHeaderImageUrl,
  resolveLifecycleSenderProfile,
} from './lifecycle-comms-service'
import { renderLifecycleEmail } from './lifecycle-renderer'

function nzLogicalDate(): Date {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value || '1970'
  const m = parts.find((p) => p.type === 'month')?.value || '01'
  const d = parts.find((p) => p.type === 'day')?.value || '01'
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
}

export type LifecycleSendCandidate = {
  companyId: string
  contactId?: string | null
  orderId?: string | null
  rewardIssueId?: string | null
  emailType: LifecycleEmailType
  recipientEmail: string
  customerFirstName?: string
  companyName?: string
  orderName?: string
  orderNumber?: string | number
  orderDate?: string
  deliveryDate?: string
  productsOrdered?: string
  totalSpend?: number
  companyOrderCount?: number
  rewardName?: string
  rewardCode?: string
  rewardExpiryDate?: string
  reviewUrl?: string
  feedbackUrl?: string
  reorderUrl?: string
  bodyCopy?: string
  subject?: string
  headerImageUrl?: string
}

export type LifecyclePreflightRow = {
  candidate: LifecycleSendCandidate
  okToSend: boolean
  reason?: string
  recipientResolved: string
  sendMode: 'test' | 'live'
}

async function upsertLifecycleLog(input: {
  companyId: string
  contactId?: string | null
  orderId?: string | null
  rewardIssueId?: string | null
  emailType: LifecycleEmailType
  recipientEmail: string
  status: string
  reason?: string | null
  senderEmail?: string | null
  approvedBy?: string | null
  approvedAt?: Date | null
  sendMode?: string | null
  sentAt?: Date | null
  metadata?: Record<string, any>
}) {
  const notificationDate = nzLogicalDate()
  return (prisma as any).lifecycleEmailSendLog.upsert({
    where: {
      companyId_emailType_notificationDate: {
        companyId: input.companyId,
        emailType: input.emailType,
        notificationDate,
      },
    },
    update: {
      contactId: input.contactId || null,
      orderId: input.orderId || null,
      rewardIssueId: input.rewardIssueId || null,
      recipientEmail: input.recipientEmail,
      senderEmail: input.senderEmail || null,
      status: input.status,
      reason: input.reason || null,
      metadata: input.metadata || undefined,
      approvedBy: input.approvedBy || null,
      approvedAt: input.approvedAt || null,
      sendMode: input.sendMode || null,
      sentAt: input.sentAt || null,
    },
    create: {
      companyId: input.companyId,
      contactId: input.contactId || null,
      orderId: input.orderId || null,
      rewardIssueId: input.rewardIssueId || null,
      emailType: input.emailType,
      notificationDate,
      recipientEmail: input.recipientEmail,
      senderEmail: input.senderEmail || null,
      status: input.status,
      reason: input.reason || null,
      metadata: input.metadata || undefined,
      approvedBy: input.approvedBy || null,
      approvedAt: input.approvedAt || null,
      sendMode: input.sendMode || null,
      sentAt: input.sentAt || null,
    },
  })
}

export async function preflightLifecycleCandidates(
  candidates: LifecycleSendCandidate[],
  options?: { forceTestMode?: boolean; forceLiveMode?: boolean }
): Promise<{
  settings: ReturnType<typeof normalizeLifecycleSettings>
  rows: LifecyclePreflightRow[]
}> {
  const rawSettings = await ensureLifecycleCommsSettings()
  const settings = normalizeLifecycleSettings(rawSettings)
  const notificationDate = nzLogicalDate()
  const rows: LifecyclePreflightRow[] = []

  for (const candidate of candidates) {
    const recipient = String(candidate.recipientEmail || '').trim().toLowerCase()
    const effectiveLiveMode = options?.forceTestMode
      ? false
      : options?.forceLiveMode
        ? true
        : settings.liveMode
    const recipientResolved = effectiveLiveMode ? recipient : String(settings.testRecipientEmail || '').trim().toLowerCase()
    if (!recipientResolved) {
      rows.push({
        candidate,
        okToSend: false,
        reason: settings.liveMode ? 'missing_recipient' : 'test_recipient_not_configured',
        recipientResolved,
        sendMode: effectiveLiveMode ? 'live' : 'test',
      })
      continue
    }

    const optedOut = await (prisma as any).orderNotificationOptOut.findUnique({
      where: { email: recipient.toLowerCase() },
    })
    if (optedOut) {
      rows.push({
        candidate,
        okToSend: false,
        reason: 'opted_out',
        recipientResolved,
        sendMode: effectiveLiveMode ? 'live' : 'test',
      })
      continue
    }

    if (effectiveLiveMode) {
      const existingTypeToday = await (prisma as any).lifecycleEmailSendLog.findUnique({
        where: {
          companyId_emailType_notificationDate: {
            companyId: candidate.companyId,
            emailType: candidate.emailType,
            notificationDate,
          },
        },
      })
      if (existingTypeToday?.status === 'sent') {
        rows.push({
          candidate,
          okToSend: false,
          reason: 'already_sent_this_type_today',
          recipientResolved,
          sendMode: settings.liveMode ? 'live' : 'test',
        })
        continue
      }

      const existingRecipientToday = await (prisma as any).lifecycleEmailSendLog.findFirst({
        where: {
          recipientEmail: recipient,
          notificationDate,
          status: 'sent',
        },
      })
      if (existingRecipientToday) {
        rows.push({
          candidate,
          okToSend: false,
          reason: 'recipient_daily_limit',
          recipientResolved,
          sendMode: effectiveLiveMode ? 'live' : 'test',
        })
        continue
      }
    }

    rows.push({
      candidate,
      okToSend: true,
      recipientResolved,
      sendMode: effectiveLiveMode ? 'live' : 'test',
    })
  }

  return { settings, rows }
}

export async function sendLifecycleCandidates(input: {
  candidates: LifecycleSendCandidate[]
  approvedBy: string
  bulk: boolean
  allowLive: boolean
  forceTestMode?: boolean
  forceLiveMode?: boolean
}) {
  const { settings, rows } = await preflightLifecycleCandidates(input.candidates, {
    forceTestMode: input.forceTestMode,
    forceLiveMode: input.forceLiveMode,
  })
  const sender = resolveLifecycleSenderProfile(settings)
  const appUrl = getAppUrl()
  const transporter = buildTransporter()
  const results: Array<{ candidate: LifecycleSendCandidate; status: string; reason?: string }> = []

  for (const row of rows) {
    const candidate = row.candidate
    const sendMode =
      row.sendMode === 'live'
        ? input.bulk
          ? 'live_bulk'
          : 'live_single'
        : input.bulk
        ? 'test_bulk'
        : 'test_single'

    await upsertLifecycleLog({
      companyId: candidate.companyId,
      contactId: candidate.contactId,
      orderId: candidate.orderId,
      rewardIssueId: candidate.rewardIssueId,
      emailType: candidate.emailType,
      recipientEmail: row.recipientResolved || candidate.recipientEmail,
      status: 'approved',
      reason: null,
      senderEmail: sender.fromEmail,
      approvedBy: input.approvedBy,
      approvedAt: new Date(),
      sendMode,
      metadata: {
        preflight: row.reason || 'ok',
        allowLive: input.allowLive,
        intendedRecipient: candidate.recipientEmail,
        recipientUsed: row.recipientResolved || candidate.recipientEmail,
        testRecipientUsed: row.sendMode === 'test' ? (row.recipientResolved || null) : null,
        sendModeLabel: row.sendMode === 'test' ? 'TEST' : 'LIVE',
      },
    })

    if (!row.okToSend) {
      await upsertLifecycleLog({
        companyId: candidate.companyId,
        contactId: candidate.contactId,
        orderId: candidate.orderId,
        rewardIssueId: candidate.rewardIssueId,
        emailType: candidate.emailType,
        recipientEmail: row.recipientResolved || candidate.recipientEmail,
        status: 'skipped_dedupe',
        reason: row.reason || 'preflight_blocked',
        senderEmail: sender.fromEmail,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        sendMode,
        metadata: {
          intendedRecipient: candidate.recipientEmail,
          recipientUsed: row.recipientResolved || candidate.recipientEmail,
          testRecipientUsed: row.sendMode === 'test' ? (row.recipientResolved || null) : null,
          sendModeLabel: row.sendMode === 'test' ? 'TEST' : 'LIVE',
        },
      })
      results.push({ candidate, status: 'skipped', reason: row.reason || 'preflight_blocked' })
      continue
    }

    const effectiveLiveMode = input.forceTestMode ? false : input.forceLiveMode ? true : settings.liveMode
    if (effectiveLiveMode && !input.allowLive) {
      await upsertLifecycleLog({
        companyId: candidate.companyId,
        contactId: candidate.contactId,
        orderId: candidate.orderId,
        rewardIssueId: candidate.rewardIssueId,
        emailType: candidate.emailType,
        recipientEmail: row.recipientResolved,
        status: 'skipped_live_mode_guard',
        reason: 'live_send_not_allowed_for_this_call',
        senderEmail: sender.fromEmail,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        sendMode,
        metadata: {
          intendedRecipient: candidate.recipientEmail,
          recipientUsed: row.recipientResolved,
          testRecipientUsed: row.sendMode === 'test' ? row.recipientResolved : null,
          sendModeLabel: row.sendMode === 'test' ? 'TEST' : 'LIVE',
        },
      })
      results.push({ candidate, status: 'skipped', reason: 'live_send_not_allowed_for_this_call' })
      continue
    }

    try {
      const headerImageUrl =
        candidate.headerImageUrl || resolveLifecycleHeaderImageUrl(settings, candidate.emailType, appUrl)
      const subject =
        candidate.subject ||
        lifecycleSubjectForType(settings, candidate.emailType) ||
        `${candidate.emailType} from Cater Station`
      const rendered = renderLifecycleEmail({
        emailType: candidate.emailType,
        subject: effectiveLiveMode ? subject : `[TEST] ${subject}`,
        bodyCopy: candidate.bodyCopy || settings.emailTypeConfig[candidate.emailType]?.bodyCopy,
        headerImageUrl,
        mergeVars: {
          customerFirstName: candidate.customerFirstName,
          companyName: candidate.companyName,
          orderName: candidate.orderName,
          orderNumber: candidate.orderNumber,
          orderDate: candidate.orderDate,
          deliveryDate: candidate.deliveryDate,
          productsOrdered: candidate.productsOrdered,
          totalSpend: candidate.totalSpend,
          companyOrderCount: candidate.companyOrderCount,
          rewardName: candidate.rewardName,
          rewardCode: candidate.rewardCode,
          rewardExpiryDate: candidate.rewardExpiryDate,
          reviewUrl: candidate.reviewUrl,
          feedbackUrl: candidate.feedbackUrl,
          reorderUrl: candidate.reorderUrl,
          headerImageUrl,
          recipientEmail: effectiveLiveMode ? candidate.recipientEmail : row.recipientResolved,
        },
      })

      await transporter.sendMail({
        from: `"${sender.fromName}" <${sender.fromEmail}>`,
        to: row.recipientResolved,
        replyTo: sender.replyTo,
        subject: rendered.subject,
        html: rendered.html,
      })

      await upsertLifecycleLog({
        companyId: candidate.companyId,
        contactId: candidate.contactId,
        orderId: candidate.orderId,
        rewardIssueId: candidate.rewardIssueId,
        emailType: candidate.emailType,
        recipientEmail: row.recipientResolved,
        status: 'sent',
        reason: null,
        senderEmail: sender.fromEmail,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        sendMode,
        sentAt: new Date(),
        metadata: {
          intendedRecipient: candidate.recipientEmail,
          recipientUsed: row.recipientResolved,
          testRecipientUsed: row.sendMode === 'test' ? row.recipientResolved : null,
          sendModeLabel: row.sendMode === 'test' ? 'TEST' : 'LIVE',
        },
      })
      if (candidate.rewardIssueId) {
        await (prisma as any).rewardIssue.update({
          where: { rewardIssueId: candidate.rewardIssueId },
          data: { status: 'sent' },
        }).catch(() => undefined)
      }
      results.push({ candidate, status: 'sent' })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'send_failed'
      await upsertLifecycleLog({
        companyId: candidate.companyId,
        contactId: candidate.contactId,
        orderId: candidate.orderId,
        rewardIssueId: candidate.rewardIssueId,
        emailType: candidate.emailType,
        recipientEmail: row.recipientResolved,
        status: 'failed',
        reason,
        senderEmail: sender.fromEmail,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
        sendMode,
        metadata: {
          intendedRecipient: candidate.recipientEmail,
          recipientUsed: row.recipientResolved,
          testRecipientUsed: row.sendMode === 'test' ? row.recipientResolved : null,
          sendModeLabel: row.sendMode === 'test' ? 'TEST' : 'LIVE',
        },
      })
      results.push({ candidate, status: 'failed', reason })
    }
  }

  return {
    settings,
    preflight: rows,
    results,
  }
}
