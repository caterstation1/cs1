import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { buildCandidateFromSuggestion } from '@/lib/lifecycle/lifecycle-admin-service'
import {
  customTemplateSendOverrides,
  resolveStoredEmailTemplateSelection,
} from '@/lib/lifecycle/email-template-selection-service'
import {
  ensureLifecycleCommsSettings,
  lifecycleSubjectForType,
  normalizeLifecycleSettings,
  resolveLifecycleHeaderImageUrl,
} from '@/lib/lifecycle/lifecycle-comms-service'
import { getAppUrl } from '@/lib/order-notification-email'
import { renderLifecycleEmail } from '@/lib/lifecycle/lifecycle-renderer'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
    const companyId = String(request.nextUrl.searchParams.get('companyId') || '').trim()
    const emailTypeRaw = String(request.nextUrl.searchParams.get('emailType') || '').trim()
    const customTemplateId = String(request.nextUrl.searchParams.get('customTemplateId') || '').trim()
    const templateKeyRaw = String(request.nextUrl.searchParams.get('templateKey') || '').trim()
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const templateSelection = await resolveStoredEmailTemplateSelection({
      value:
        templateKeyRaw ||
        (customTemplateId ? `custom:${customTemplateId}` : '') ||
        emailTypeRaw ||
        'FIRST_ORDER_POST_PURCHASE',
    })
    const emailType = templateSelection.emailType
    const customOverrides = customTemplateSendOverrides(templateSelection)

    const contactId = request.nextUrl.searchParams.get('contactId')
    const orderId = request.nextUrl.searchParams.get('orderId')
    const rewardIssueId = request.nextUrl.searchParams.get('rewardIssueId')
    const subjectOverride = request.nextUrl.searchParams.get('subject') || undefined
    const bodyCopyOverride = request.nextUrl.searchParams.get('bodyCopy') || undefined
    const headerImageUrlOverride = request.nextUrl.searchParams.get('headerImageUrl') || undefined
    const reviewUrlOverride = request.nextUrl.searchParams.get('reviewUrl') || undefined

    const [candidate, rawSettings] = await Promise.all([
      buildCandidateFromSuggestion({
        companyId,
        contactId,
        orderId,
        emailType,
        rewardIssueId,
        subject: subjectOverride || customOverrides.subject,
        bodyCopy: bodyCopyOverride || customOverrides.bodyCopy,
      }),
      ensureLifecycleCommsSettings(),
    ])
    const settings = normalizeLifecycleSettings(rawSettings)
    const appUrl = getAppUrl()
    const headerImageUrl = (() => {
      if (headerImageUrlOverride) {
        if (/^https?:\/\//i.test(headerImageUrlOverride)) return headerImageUrlOverride
        return `${appUrl}${headerImageUrlOverride.startsWith('/') ? headerImageUrlOverride : `/${headerImageUrlOverride}`}`
      }
      if (customOverrides.headerImageUrl) return customOverrides.headerImageUrl
      return resolveLifecycleHeaderImageUrl(settings, emailType, appUrl)
    })()
    const rendered = renderLifecycleEmail({
      emailType,
      subject: candidate.subject || lifecycleSubjectForType(settings, emailType),
      bodyCopy: candidate.bodyCopy || settings.emailTypeConfig[emailType]?.bodyCopy,
      headerImageUrl,
      mergeVars: {
        customerFirstName: candidate.customerFirstName,
        companyName: candidate.companyName,
        orderName: candidate.orderName,
        orderNumber: candidate.orderNumber,
        orderDate: candidate.orderDate,
        productsOrdered: candidate.productsOrdered,
        totalSpend: candidate.totalSpend,
        companyOrderCount: candidate.companyOrderCount,
        rewardName: candidate.rewardName || undefined,
        rewardCode: candidate.rewardCode || undefined,
        rewardExpiryDate: candidate.rewardExpiryDate,
        reviewUrl: reviewUrlOverride || candidate.reviewUrl,
        feedbackUrl: candidate.feedbackUrl,
        reorderUrl: candidate.reorderUrl,
        recipientEmail: candidate.recipientEmail,
      },
    })
    return new NextResponse(rendered.html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to render lifecycle preview' }, { status: error?.status || 500 })
  }
}
