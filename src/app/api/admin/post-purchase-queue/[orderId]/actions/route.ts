import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { buildCandidateFromSuggestion } from '@/lib/lifecycle/lifecycle-admin-service'
import { sendLifecycleCandidates } from '@/lib/lifecycle/lifecycle-send'
import {
  customTemplateSendOverrides,
  emailTemplateStorageKey,
  resolveStoredEmailTemplateSelection,
} from '@/lib/lifecycle/email-template-selection-service'
import { issueReward } from '@/lib/lifecycle/reward-issue-service'
import { ensureVoucherForSend } from '@/lib/lifecycle/voucher-send-service'
import { POST as fulfillOrderRoute } from '@/app/api/orders/[id]/fulfill/route'

async function resolveQueueEmailTemplate(input: {
  emailTypeRaw: string
  followupSelectedEmailType: string | null | undefined
  suggestedEmailType?: string | null
}) {
  const selection = await resolveStoredEmailTemplateSelection({
    value:
      input.emailTypeRaw ||
      input.followupSelectedEmailType ||
      input.suggestedEmailType ||
      'FIRST_ORDER_POST_PURCHASE',
  })
  return selection
}

const TERMINAL_BEFORE_COMPLETE = new Set(['sent', 'skipped', 'no_followup'])

async function ensureFollowup(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

  const companyOrder = await (prisma as any).companyOrder.findUnique({
    where: { shopifyOrderId: order.shopifyId },
    include: {
      company: {
        include: {
          contacts: {
            orderBy: [{ isPrimaryContact: 'desc' }, { totalSpend: 'desc' }],
            take: 5,
          },
        },
      },
    },
  })
  const company = companyOrder?.company || null
  const contact =
    company?.contacts?.find((c: any) => c.isPrimaryContact && c.email) ||
    company?.contacts?.find((c: any) => c.email) ||
    null

  let followup = await (prisma as any).postPurchaseFollowup.findUnique({
    where: { orderId: order.id },
  })
  if (!followup) {
    followup = await (prisma as any).postPurchaseFollowup.create({
      data: {
        orderId: order.id,
        shopifyOrderId: order.shopifyId,
        companyId: company?.companyId || null,
        contactId: contact?.contactId || null,
        status: company?.companyId ? 'pending_review' : 'blocked',
        blockedReason: company?.companyId ? null : 'company_unmatched',
      },
    })
  }
  return { order, company, contact, followup }
}

async function logAction(input: {
  followupId: string
  orderId: string
  actionType: string
  actionStatus?: string
  emailType?: string | null
  rewardIssueId?: string | null
  rewardCatalogId?: string | null
  reason?: string | null
  actedBy: string
  metadata?: Record<string, any>
}) {
  await (prisma as any).postPurchaseFollowupAction.create({
    data: {
      postPurchaseFollowupId: input.followupId,
      orderId: input.orderId,
      actionType: input.actionType,
      actionStatus: input.actionStatus || 'ok',
      emailType: input.emailType || null,
      rewardIssueId: input.rewardIssueId || null,
      rewardCatalogId: input.rewardCatalogId || null,
      reason: input.reason || null,
      metadata: input.metadata || undefined,
      actedBy: input.actedBy,
      actedAt: new Date(),
    },
  })
}

async function tryFulfillInShopify(orderId: string) {
  const req = new NextRequest(`http://internal/api/orders/${encodeURIComponent(orderId)}/fulfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notifyCustomer: false }),
  })
  const res = await fulfillOrderRoute(req, {
    params: Promise.resolve({ id: orderId }),
  })
  const payload = await res.json().catch(() => ({}))
  return {
    ok: res.ok,
    status: res.status,
    payload,
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const role = await requireRole(['owner', 'admin'])
    const params = await context.params
    const orderId = String(params.orderId || '').trim()
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const emailType = String(body.emailType || '').trim()
    const reason = String(body.reason || '').trim() || null
    const rewardCatalogId = body.rewardCatalogId ? String(body.rewardCatalogId) : null
    const voucherTemplateId = body.voucherTemplateId ? String(body.voucherTemplateId) : null

    if (!orderId || !action) {
      return NextResponse.json({ error: 'orderId and action are required' }, { status: 400 })
    }

    const { order, company, contact, followup } = await ensureFollowup(orderId)
    const templateSelection = await resolveQueueEmailTemplate({
      emailTypeRaw: emailType,
      followupSelectedEmailType: followup.selectedEmailType,
    })
    const selectedEmailType = templateSelection.emailType
    const selectedTemplateKey = emailTemplateStorageKey(templateSelection)
    const customOverrides = customTemplateSendOverrides(templateSelection)

    if (action === 'preview') {
      const effectiveVoucherTemplateId =
        voucherTemplateId || String(followup.selectedVoucherTemplateId || '') || null
      let rewardIssueId = String(followup.selectedRewardIssueId || '') || null
      let voucherResult: Awaited<ReturnType<typeof ensureVoucherForSend>> | null = null

      if (effectiveVoucherTemplateId && company?.companyId) {
        voucherResult = await ensureVoucherForSend({
          companyId: company.companyId,
          contactId: contact?.contactId || null,
          customerEmail: contact?.email || order.customerEmail,
          shopifyCustomerId: contact?.shopifyCustomerId || null,
          companyName: company.canonicalCompanyName || null,
          voucherTemplateId: effectiveVoucherTemplateId,
          existingRewardIssueId: rewardIssueId,
          syncShopify: false,
        })
        rewardIssueId = voucherResult.rewardIssueId
      }

      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          status: 'previewed',
          selectedEmailType: selectedTemplateKey,
          selectedVoucherTemplateId: effectiveVoucherTemplateId,
          selectedRewardIssueId: rewardIssueId,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'previewed',
        emailType: selectedEmailType,
        actedBy: role,
        metadata: { voucherResult },
      })
      return NextResponse.json({
        success: true,
        followup: updated,
        rewardIssueId,
        rewardCode: voucherResult?.rewardCode || null,
      })
    }

    if (action === 'send') {
      if (!company?.companyId) {
        return NextResponse.json({ error: 'Order is not mapped to a company' }, { status: 400 })
      }

      const effectiveVoucherTemplateId =
        voucherTemplateId || String(followup.selectedVoucherTemplateId || '') || null
      let rewardIssueId = String(followup.selectedRewardIssueId || '') || null
      let voucherResult: Awaited<ReturnType<typeof ensureVoucherForSend>> | null = null

      if (effectiveVoucherTemplateId) {
        try {
          voucherResult = await ensureVoucherForSend({
            companyId: company.companyId,
            contactId: contact?.contactId || null,
            customerEmail: contact?.email || order.customerEmail,
            shopifyCustomerId: contact?.shopifyCustomerId || null,
            companyName: company.canonicalCompanyName || null,
            voucherTemplateId: effectiveVoucherTemplateId,
            existingRewardIssueId: rewardIssueId,
            syncShopify: true,
          })
          rewardIssueId = voucherResult.rewardIssueId
        } catch (voucherError: any) {
          return NextResponse.json(
            { error: voucherError?.message || 'Failed to provision voucher in Shopify' },
            { status: 400 }
          )
        }
      }

      const candidate = await buildCandidateFromSuggestion({
        companyId: company.companyId,
        contactId: contact?.contactId || null,
        orderId: order.shopifyId,
        emailType: selectedEmailType,
        rewardIssueId,
        subject: customOverrides.subject,
        bodyCopy: customOverrides.bodyCopy,
      })
      if (customOverrides.headerImageUrl) {
        ;(candidate as any).headerImageUrl = customOverrides.headerImageUrl
      }
      const result = await sendLifecycleCandidates({
        candidates: [candidate],
        approvedBy: role,
        bulk: false,
        allowLive: true,
        forceLiveMode: true,
      })
      const sendResult = result?.results?.[0]
      const sendOk = sendResult?.status === 'sent'
      const sendMode = result?.preflight?.[0]?.sendMode || null
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          status: sendOk ? 'sent' : 'blocked',
          blockedReason: sendOk ? null : sendResult?.reason || 'send_failed',
          selectedEmailType: selectedTemplateKey,
          selectedVoucherTemplateId: effectiveVoucherTemplateId,
          selectedRewardIssueId: rewardIssueId,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: sendOk ? 'sent' : 'send_attempted',
        actionStatus: sendOk ? 'ok' : 'blocked',
        emailType: selectedEmailType,
        reason: sendOk ? null : sendResult?.reason || 'send_failed',
        actedBy: role,
        metadata: {
          lifecycleResult: sendResult || null,
          voucherResult,
        },
      })

      // Auto-fulfill in Shopify only for successful LIVE manual sends.
      let fulfillResult: any = null
      if (sendOk && sendMode === 'live') {
        fulfillResult = await tryFulfillInShopify(order.id)
        await logAction({
          followupId: followup.postPurchaseFollowupId,
          orderId: order.id,
          actionType: 'marked_fulfilled',
          actionStatus: fulfillResult.ok ? 'ok' : 'blocked',
          emailType: selectedEmailType,
          reason: fulfillResult.ok ? null : `shopify_fulfill_failed_${fulfillResult.status}`,
          actedBy: role,
          metadata: {
            source: 'post_purchase_send',
            shopifyFulfill: fulfillResult,
          },
        })
      }
      return NextResponse.json({ success: true, followup: updated, result, sendMode, fulfillResult })
    }

    if (action === 'skip' || action === 'no_followup') {
      const nextStatus = action === 'skip' ? 'skipped' : 'no_followup'
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          status: nextStatus,
          blockedReason: null,
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: action === 'skip' ? 'skipped' : 'no_followup',
        emailType: selectedEmailType,
        reason,
        actedBy: role,
      })
      let fulfillResult: any = null
      if (String(order.fulfillmentStatus || '').toLowerCase() !== 'fulfilled') {
        fulfillResult = await tryFulfillInShopify(order.id)
        await logAction({
          followupId: followup.postPurchaseFollowupId,
          orderId: order.id,
          actionType: 'marked_fulfilled',
          actionStatus: fulfillResult.ok ? 'ok' : 'blocked',
          emailType: selectedEmailType,
          reason: fulfillResult.ok ? null : `shopify_fulfill_failed_${fulfillResult.status}`,
          actedBy: role,
          metadata: {
            source: action,
            shopifyFulfill: fulfillResult,
          },
        })
      }
      return NextResponse.json({ success: true, followup: updated, fulfillResult })
    }

    if (action === 'mark_fulfilled') {
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'fulfilled' },
      })
      const shouldComplete = TERMINAL_BEFORE_COMPLETE.has(String(followup.status || ''))
      const updateData: any = {
        lastActionAt: new Date(),
        lastActionBy: role,
      }
      if (shouldComplete) {
        updateData.status = 'completed'
      }
      const updatedFollowup = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: updateData,
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'marked_fulfilled',
        actedBy: role,
        metadata: { statusAfter: updatedFollowup.status },
      })
      return NextResponse.json({ success: true, order: updatedOrder, followup: updatedFollowup })
    }

    if (action === 'mark_strategic') {
      if (!company?.companyId) {
        return NextResponse.json({ error: 'Order is not mapped to a company' }, { status: 400 })
      }
      await (prisma as any).company.update({
        where: { companyId: company.companyId },
        data: { isStrategicOverride: true },
      })
      await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: { lastActionAt: new Date(), lastActionBy: role },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'strategic_marked',
        actedBy: role,
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'select_email_template') {
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'previewed',
        emailType: selectedEmailType,
        actedBy: role,
        metadata: { templateKey: selectedTemplateKey },
      })
      return NextResponse.json({ success: true, followup: updated })
    }

    if (action === 'select_voucher') {
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          selectedVoucherTemplateId: voucherTemplateId,
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'reward_selected',
        emailType: selectedEmailType,
        actedBy: role,
        metadata: { voucherTemplateId },
      })
      return NextResponse.json({ success: true, followup: updated })
    }

    if (action === 'select_reward') {
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          selectedRewardCatalogId: rewardCatalogId,
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'reward_selected',
        rewardCatalogId,
        emailType: selectedEmailType,
        actedBy: role,
      })
      return NextResponse.json({ success: true, followup: updated })
    }

    if (action === 'issue_reward') {
      if (!company?.companyId) {
        return NextResponse.json({ error: 'Order is not mapped to a company' }, { status: 400 })
      }
      const effectiveRewardCatalogId = rewardCatalogId || String(followup.selectedRewardCatalogId || '')
      if (!effectiveRewardCatalogId) {
        return NextResponse.json({ error: 'rewardCatalogId is required' }, { status: 400 })
      }
      const rewardIssue = await issueReward({
        companyId: company.companyId,
        contactId: contact?.contactId || null,
        rewardCatalogId: effectiveRewardCatalogId,
        sourceType: 'manual',
        sourceRuleKey: 'post_purchase_queue',
        notes: reason || undefined,
        status: 'issued',
      })
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          selectedRewardCatalogId: effectiveRewardCatalogId,
          selectedRewardIssueId: rewardIssue.rewardIssueId,
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'reward_issued',
        rewardIssueId: rewardIssue.rewardIssueId,
        rewardCatalogId: effectiveRewardCatalogId,
        emailType: selectedEmailType,
        actedBy: role,
      })
      return NextResponse.json({ success: true, followup: updated, rewardIssue })
    }

    if (action === 'mark_blocked') {
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          status: 'blocked',
          blockedReason: reason || 'manual_blocked',
          selectedEmailType: selectedTemplateKey,
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'marked_blocked',
        reason: reason || 'manual_blocked',
        emailType: selectedEmailType,
        actedBy: role,
      })
      return NextResponse.json({ success: true, followup: updated })
    }

    if (action === 'mark_completed') {
      const allowed = TERMINAL_BEFORE_COMPLETE.has(String(followup.status || ''))
      if (!allowed) {
        return NextResponse.json(
          { error: 'Only sent/skipped/no_followup items can be marked completed' },
          { status: 400 }
        )
      }
      const updated = await (prisma as any).postPurchaseFollowup.update({
        where: { postPurchaseFollowupId: followup.postPurchaseFollowupId },
        data: {
          status: 'completed',
          lastActionAt: new Date(),
          lastActionBy: role,
        },
      })
      await logAction({
        followupId: followup.postPurchaseFollowupId,
        orderId: order.id,
        actionType: 'marked_fulfilled',
        actionStatus: 'ok',
        reason: 'Manually marked completed',
        actedBy: role,
        metadata: { statusBefore: followup.status, statusAfter: 'completed' },
      })
      return NextResponse.json({ success: true, followup: updated })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to process post-purchase action' }, { status: error?.status || 500 })
  }
}

