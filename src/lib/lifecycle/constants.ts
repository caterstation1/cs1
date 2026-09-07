export const LIFECYCLE_COMMS_SETTINGS_KEY = 'LIFECYCLE_COMMS'

export const LIFECYCLE_EMAIL_TYPES = [
  'FIRST_ORDER_POST_PURCHASE',
  'REPEAT_ORDER_POST_PURCHASE',
  'REVIEW_REQUEST',
  'FEEDBACK_REQUEST',
  'SECOND_ORDER_INCENTIVE',
  'STRATEGIC_SECOND_ORDER_VOUCHER',
  'SPEND_MILESTONE_REWARD',
  'REACTIVATION',
  'VIP',
] as const

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number]

export const DEFAULT_LIFECYCLE_HEADER_PATHS: Record<LifecycleEmailType, string> = {
  FIRST_ORDER_POST_PURCHASE: '/email-headers/first-order-post-purchase.jpg',
  REPEAT_ORDER_POST_PURCHASE: '/email-headers/repeat-order-post-purchase.jpg',
  REVIEW_REQUEST: '/email-headers/review-request.jpg',
  FEEDBACK_REQUEST: '/email-headers/feedback-request.jpg',
  SECOND_ORDER_INCENTIVE: '/email-headers/second-order-incentive.jpg',
  STRATEGIC_SECOND_ORDER_VOUCHER: '/email-headers/strategic-second-order-voucher.jpg',
  SPEND_MILESTONE_REWARD: '/email-headers/spend-milestone-reward.jpg',
  REACTIVATION: '/email-headers/reactivation.jpg',
  VIP: '/email-headers/vip.jpg',
}

export const DEFAULT_FALLBACK_HEADER_PATH = '/email-headers/default.jpg'

export const DEFAULT_REWARD_RULE_CONFIG = {
  firstOrderRewardCodePrefix: 'FIRST',
  strategicThreshold: 600,
  strategicReminderDelayDays: 30,
  strategicVoucherMinSpend: 500,
  strategicVoucherValue: 100,
  strategicVoucherExpiryDays: 30,
  spendMilestoneInterval: 1000,
  spendMilestoneCooldownDays: 30,
  reviewUrl: '',
  feedbackUrl: '',
  reorderUrl: '',
  voucherTemplates: [] as Array<Record<string, unknown>>,
}

export const DEFAULT_EMAIL_TYPE_CONFIG: Record<
  LifecycleEmailType,
  { enabled: boolean; subject: string; headerImagePath: string; bodyCopy?: string }
> = {
  FIRST_ORDER_POST_PURCHASE: {
    enabled: true,
    subject: 'Thanks for your first order with Cater Station',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.FIRST_ORDER_POST_PURCHASE,
  },
  REPEAT_ORDER_POST_PURCHASE: {
    enabled: true,
    subject: 'Thanks again for ordering with Cater Station',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.REPEAT_ORDER_POST_PURCHASE,
  },
  REVIEW_REQUEST: {
    enabled: true,
    subject: 'How was your Cater Station order?',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.REVIEW_REQUEST,
  },
  FEEDBACK_REQUEST: {
    enabled: true,
    subject: 'We would love your feedback',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.FEEDBACK_REQUEST,
  },
  SECOND_ORDER_INCENTIVE: {
    enabled: true,
    subject: 'A little thank-you for your next order',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.SECOND_ORDER_INCENTIVE,
  },
  STRATEGIC_SECOND_ORDER_VOUCHER: {
    enabled: true,
    subject: 'A priority offer for your team',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.STRATEGIC_SECOND_ORDER_VOUCHER,
  },
  SPEND_MILESTONE_REWARD: {
    enabled: true,
    subject: 'You unlocked a Cater Station reward',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.SPEND_MILESTONE_REWARD,
  },
  REACTIVATION: {
    enabled: true,
    subject: 'We would love to cater your team again',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.REACTIVATION,
  },
  VIP: {
    enabled: true,
    subject: 'VIP update from Cater Station',
    headerImagePath: DEFAULT_LIFECYCLE_HEADER_PATHS.VIP,
  },
}
