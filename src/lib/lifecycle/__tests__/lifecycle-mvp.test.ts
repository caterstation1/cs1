import assert from 'node:assert/strict'
import { DEFAULT_EMAIL_TYPE_CONFIG, LIFECYCLE_EMAIL_TYPES } from '../constants'
import { applyMergeVars, defaultBodyForEmailType, renderLifecycleEmail } from '../lifecycle-renderer'

function run() {
  for (const type of LIFECYCLE_EMAIL_TYPES) {
    assert.equal(Boolean(DEFAULT_EMAIL_TYPE_CONFIG[type]), true)
    assert.ok(DEFAULT_EMAIL_TYPE_CONFIG[type].headerImagePath.includes('/email-headers/'))
    assert.ok(defaultBodyForEmailType(type).length > 0)
  }

  const merged = applyMergeVars('Hi {{ customerFirstName }}, code {{rewardCode}}', {
    recipientEmail: 'test@example.com',
    customerFirstName: 'Sofia',
    rewardCode: 'ABC-123',
  })
  assert.equal(merged, 'Hi Sofia, code ABC-123')

  const rendered = renderLifecycleEmail({
    emailType: 'SECOND_ORDER_INCENTIVE',
    subject: 'Test {{companyName}}',
    bodyCopy: 'Hey {{customerFirstName}}',
    headerImageUrl: 'https://example.com/email-headers/default.jpg',
    mergeVars: {
      recipientEmail: 'sofia@example.com',
      customerFirstName: 'Sofia',
      companyName: 'Cater Co',
      rewardName: 'Free Tater Tots',
      rewardCode: 'FIRST-XYZ',
    },
  })
  assert.ok(rendered.subject.includes('Cater Co'))
  assert.ok(rendered.html.includes('FIRST-XYZ'))
  assert.ok(!rendered.html.includes('Free Tater Tots'))
  assert.ok(rendered.html.includes('opt out here'))

  const inlineVoucher = renderLifecycleEmail({
    emailType: 'FIRST_ORDER_POST_PURCHASE',
    subject: 'Thanks',
    bodyCopy: '**Use code: CSTATER2026**',
    headerImageUrl: 'https://example.com/email-headers/default.jpg',
    mergeVars: {
      recipientEmail: 'test@example.com',
      customerFirstName: 'Ahry',
      rewardCode: 'CSTATER2026-4061',
      rewardExpiryDate: '2026-07-22',
    },
  })
  assert.ok(inlineVoucher.html.includes('CSTATER2026-4061'))
  assert.ok(inlineVoucher.html.includes('valid until 2026-07-22'))
  assert.ok(!inlineVoucher.html.includes('Your code:'))

  const placeholderVoucher = renderLifecycleEmail({
    emailType: 'FIRST_ORDER_POST_PURCHASE',
    subject: 'Thanks',
    bodyCopy: 'Use code: [reward-code] (valid until [reward-expiry-date])',
    headerImageUrl: 'https://example.com/email-headers/default.jpg',
    mergeVars: {
      recipientEmail: 'test@example.com',
      customerFirstName: 'Ahry',
      rewardCode: 'CSTATER2026-4061',
      rewardExpiryDate: '2026-07-22',
    },
  })
  assert.ok(placeholderVoucher.html.includes('CSTATER2026-4061'))
  assert.ok(placeholderVoucher.html.includes('2026-07-22'))
  assert.ok(!placeholderVoucher.html.includes('Your code:'))

  const htmlWithTrailingPrefix = renderLifecycleEmail({
    emailType: 'SPEND_MILESTONE_REWARD',
    subject: 'Milestone reward',
    bodyCopy: '<strong>Use code: MILESTONEDIPPER</strong>MILESTONEDIPPER',
    headerImageUrl: 'https://example.com/email-headers/default.jpg',
    mergeVars: {
      recipientEmail: 'test@example.com',
      customerFirstName: 'Sam',
      rewardCode: 'MILESTONEDIPPER-3646',
      rewardExpiryDate: '2026-08-07',
    },
  })
  assert.ok(htmlWithTrailingPrefix.html.includes('MILESTONEDIPPER-3646'))
  assert.ok(htmlWithTrailingPrefix.html.includes('valid until 2026-08-07'))
  assert.equal((htmlWithTrailingPrefix.html.match(/MILESTONEDIPPER/g) || []).length, 1)

  console.log('lifecycle mvp tests passed')
}

run()
