import { createOptOutToken } from '@/lib/order-notification-optout'
import { getAppUrl, getOptOutUrl } from '@/lib/order-notification-email'
import { LifecycleEmailType } from './constants'

export type LifecycleMergeVars = {
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
  headerImageUrl?: string
  recipientEmail: string
}

const BRACKET_TOKEN_ALIASES: Record<string, keyof LifecycleMergeVars> = {
  'customer-name': 'customerFirstName',
  'customer-first-name': 'customerFirstName',
  'company-name': 'companyName',
  'order-name': 'orderName',
  'order-number': 'orderNumber',
  'order-date': 'orderDate',
  'delivery-date': 'deliveryDate',
  'products-ordered': 'productsOrdered',
  'total-spend': 'totalSpend',
  'company-order-count': 'companyOrderCount',
  'reward-name': 'rewardName',
  'reward-code': 'rewardCode',
  'reward-expiry-date': 'rewardExpiryDate',
  'review-url': 'reviewUrl',
  'feedback-url': 'feedbackUrl',
  'reorder-url': 'reorderUrl',
  'header-image-url': 'headerImageUrl',
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function applyMergeVars(template: string, vars: LifecycleMergeVars): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    const safeValue = String(value ?? '')
    const mustacheToken = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g')
    out = out.replace(mustacheToken, safeValue)
  }
  for (const [alias, key] of Object.entries(BRACKET_TOKEN_ALIASES)) {
    const safeValue = String(vars[key] ?? '')
    const bracketToken = new RegExp(`\\[\\s*${escapeRegex(alias)}\\s*\\]`, 'gi')
    out = out.replace(bracketToken, safeValue)
  }
  return out
}

export function defaultBodyForEmailType(emailType: LifecycleEmailType): string {
  switch (emailType) {
    case 'FIRST_ORDER_POST_PURCHASE':
      return 'Thanks for your first order with Cater Station. We loved catering for your team.'
    case 'REPEAT_ORDER_POST_PURCHASE':
      return 'Thanks again for ordering with us. We appreciate your continued support.'
    case 'REVIEW_REQUEST':
      return 'If you have a moment, we would love a quick review from your latest order.'
    case 'FEEDBACK_REQUEST':
      return 'We are always improving. Please share any feedback from your experience.'
    case 'SECOND_ORDER_INCENTIVE':
      return 'As a thank-you, we have included a small reward for your next order.'
    case 'STRATEGIC_SECOND_ORDER_VOUCHER':
      return 'We value your account and have prepared a priority voucher for your next order.'
    case 'SPEND_MILESTONE_REWARD':
      return 'You have reached a spend milestone and unlocked a reward.'
    case 'REACTIVATION':
      return 'It has been a little while since your last order. We would love to cater your team again.'
    case 'VIP':
      return 'Thank you for being one of our VIP accounts. We appreciate your continued support.'
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInlineCopy(input: string): string {
  const escaped = escapeHtml(input)
  return escaped
    .replace(/\[u\]([\s\S]+?)\[\/u\]/gi, '<span style="text-decoration:underline;">$1</span>')
    .replace(/__([^_]+?)__/g, '<span style="text-decoration:underline;">$1</span>')
}

function sanitizeHtmlForEmail(input: string): string {
  return input
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)=("|\')\s*javascript:[^"\']*\2/gi, '')
    .replace(
      /<(?!\/?(p|br|div|span|strong|b|em|i|u|ul|ol|li|blockquote|a|h1|h2|h3|h4|h5|h6)\b)[^>]*>/gi,
      ''
    )
}

function templateIncludesRewardDetails(rawBody: string): boolean {
  return /\[(?:reward-code|reward-expiry-date)\]|\{\{\s*reward(?:Code|ExpiryDate)\s*\}\}/i.test(rawBody)
}

function voucherCodePrefix(rewardCode: string): string | null {
  const dash = rewardCode.indexOf('-')
  if (dash <= 0) return null
  return rewardCode.slice(0, dash)
}

/** Drop a trailing duplicate prefix label (e.g. MILESTONEDIPPER) once the full code is already shown. */
function stripRedundantVoucherPrefixLabel(body: string, rewardCode?: string): string {
  if (!rewardCode) return body
  const prefix = voucherCodePrefix(rewardCode)
  if (!prefix) return body

  const escapedCode = escapeRegex(rewardCode)
  const escapedPrefix = escapeRegex(prefix)

  const adjacentPrefix = new RegExp(
    '(' + escapedCode + ')(?:\\s*' + escapedPrefix + ')+(?![\\w-])',
    'gi'
  )
  const trailingPrefix = new RegExp(
    '(' + escapedCode + '(?:\\s*\\(valid until [^)]+\\))?)' +
      '(?:</[^>]+>)*\\s*' +
      escapedPrefix +
      '(?![\\w-])',
    'gi'
  )

  return body.replace(adjacentPrefix, '$1').replace(trailingPrefix, '$1')
}

/** When authors write "Use code: PREFIX" literally, expand to the issued code + expiry inline. */
function inlineVoucherDetailsInBody(
  body: string,
  rewardCode?: string,
  rewardExpiryDate?: string
): string {
  if (!rewardCode || body.includes(rewardCode) || templateIncludesRewardDetails(body)) {
    return body
  }
  if (!/use\s+code\s*:/i.test(body)) {
    return body
  }

  const expirySuffix = rewardExpiryDate ? ` (valid until ${rewardExpiryDate})` : ''
  return body.replace(/(use\s+code\s*:\s*)([^<\n]+)/gi, `$1${rewardCode}${expirySuffix}`)
}

export function renderLifecycleEmail(params: {
  emailType: LifecycleEmailType
  subject: string
  bodyCopy?: string
  mergeVars: LifecycleMergeVars
  headerImageUrl: string
}): { html: string; subject: string } {
  const appUrl = getAppUrl()
  const optOutToken = createOptOutToken(params.mergeVars.recipientEmail)
  const optOutUrl = getOptOutUrl(optOutToken, appUrl)
  const rawBody = params.bodyCopy || defaultBodyForEmailType(params.emailType)
  const mergedBody = stripRedundantVoucherPrefixLabel(
    inlineVoucherDetailsInBody(
      applyMergeVars(rawBody, params.mergeVars),
      params.mergeVars.rewardCode,
      params.mergeVars.rewardExpiryDate
    ),
    params.mergeVars.rewardCode
  )
  const showRewardBox =
    Boolean(params.mergeVars.rewardCode) &&
    !templateIncludesRewardDetails(rawBody) &&
    !mergedBody.includes(String(params.mergeVars.rewardCode))
  const looksLikeHtml = /<\s*[a-z][^>]*>/i.test(mergedBody)
  const paragraphHtml = looksLikeHtml
    ? `<div style="line-height:1.6;">${sanitizeHtmlForEmail(mergedBody)}</div>`
    : mergedBody
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => {
          if (!line.trim()) {
            // Keep deliberate blank lines from template editing.
            return '<p style="margin:0 0 12px 0;line-height:1.6;">&nbsp;</p>'
          }
          return `<p style="margin:0 0 12px 0;line-height:1.6;">${formatInlineCopy(line.trim())}</p>`
        })
        .join('')

  // When the template already has reward placeholders (or we inlined code on "Use code:"),
  // skip the auto reward box so details only appear where the author put them.
  const rewardSection = showRewardBox
      ? `
        <div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #dbeafe;">
          <p style="margin:0 0 6px 0;"><strong>Your code:</strong> ${escapeHtml(params.mergeVars.rewardCode || '')}</p>
          ${
            params.mergeVars.rewardExpiryDate
              ? `<p style="margin:0;font-size:14px;color:#4b5563;">Valid until ${escapeHtml(params.mergeVars.rewardExpiryDate)}</p>`
              : ''
          }
        </div>
      `
      : ''

  const ctaLinks = [
    params.mergeVars.reorderUrl ? `<a href="${escapeHtml(params.mergeVars.reorderUrl)}" style="margin-right:10px;color:#0f766e;">Reorder</a>` : '',
    params.mergeVars.reviewUrl
      ? `<a href="${escapeHtml(params.mergeVars.reviewUrl)}" style="margin-right:10px;color:#0f766e;text-decoration:underline;">★★★★★ Leave a review</a>`
      : '',
    params.mergeVars.feedbackUrl ? `<a href="${escapeHtml(params.mergeVars.feedbackUrl)}" style="color:#0f766e;">Share feedback</a>` : '',
  ]
    .filter(Boolean)
    .join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:10px;overflow:hidden;">
          <tr><td><img src="${escapeHtml(params.headerImageUrl)}" alt="Cater Station" style="display:block;width:100%;height:auto;" /></td></tr>
          <tr>
            <td style="padding:26px;">
              <p style="margin:0 0 12px 0;font-size:18px;">Hey ${escapeHtml(params.mergeVars.customerFirstName || 'there')}</p>
              ${paragraphHtml}
              ${rewardSection}
              ${ctaLinks ? `<p style="margin:14px 0;">${ctaLinks}</p>` : ''}
              <p style="margin:14px 0 6px 0;">Kind regards</p>
              <p style="margin:0 0 18px 0;font-weight:700;">Cater Station</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0 16px;" />
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                If you would rather not receive these order-related emails please
                <a href="${escapeHtml(optOutUrl)}" style="color:#0f766e;">opt out here</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()

  return {
    subject: applyMergeVars(params.subject, params.mergeVars),
    html,
  }
}
