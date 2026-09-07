import { ALLERGEN_VALUES } from './schemas'

/** Domain tags for routing hints and future capability UI. */
export type AiDomain =
  | 'people'
  | 'orders'
  | 'products'
  | 'analytics'
  | 'calendar'
  | 'operations'
  | 'compliance'
  | 'fallback'

export type AiToolName =
  | 'search_people'
  | 'lookup_order'
  | 'check_allergen'
  | 'print_labels'
  | 'propose_order_update'
  | 'compare_sales_periods'
  | 'get_sales_kpis'
  | 'orders_for_day'
  | 'staff_on_shift'
  | 'fcp_tasks_today'
  | 'sql_query'

export interface AiToolDef {
  name: AiToolName
  domain: AiDomain
  description: string
  argsHint: string
  examples: string[]
  /** When true, router should prefer this over sql_query for matching questions. */
  preferOverSql: boolean
}

export const AI_TOOLS: AiToolDef[] = [
  {
    name: 'search_people',
    domain: 'people',
    description: 'Find staff or customers by name; returns all matches ranked (phones/emails when PII on).',
    argsHint: '{ "query": "Sofia Grant" }',
    examples: ['What is Sofia\'s phone number?', 'Find staff named John'],
    preferOverSql: true,
  },
  {
    name: 'lookup_order',
    domain: 'orders',
    description: 'Order details by order number — delivery, customer, status, line items summary.',
    argsHint: '{ "orderNumber": 12945 }',
    examples: ['What time is order 12945 delivering?', 'Status of order 12234'],
    preferOverSql: true,
  },
  {
    name: 'check_allergen',
    domain: 'products',
    description: 'Check whether a menu item contains a specific allergen.',
    argsHint: `{ "product": "Korean Fried Chicken", "allergen": "gluten" } — allergen: ${ALLERGEN_VALUES.join(', ')}`,
    examples: ['Does butter chicken have dairy?', 'Is the wrap gluten free?'],
    preferOverSql: true,
  },
  {
    name: 'print_labels',
    domain: 'orders',
    description: 'Open the label print flow for an order.',
    argsHint: '{ "orderNumber": 12945 }',
    examples: ['Print labels for order 12945'],
    preferOverSql: true,
  },
  {
    name: 'propose_order_update',
    domain: 'orders',
    description: 'Propose an order change — user must confirm before applying. Never apply directly.',
    argsHint: '{ "orderNumber": 12234, "deliveryTime": "11:30 AM", "deliveryDate": "2025-06-24", "internalNote": "..." }',
    examples: ['Change order 12234 delivery time to 11:30', 'Set internal note on order 12800'],
    preferOverSql: true,
  },
  {
    name: 'compare_sales_periods',
    domain: 'analytics',
    description:
      'Compare sales between two NZ-time periods (e.g. this week WTD vs same days last week). Uses order createdAt and paid orders.',
    argsHint:
      '{ "currentPeriod": "this_week_wtd", "comparePeriod": "last_week_same_days" } — periods: today, yesterday, this_week_wtd, last_week_same_days, last_week_full, this_month_mtd, last_month_same_days, last_7d, last_30d, ytd',
    examples: [
      'How are sales compared to last week to date?',
      'Are we up or down vs last week?',
      'This week vs same period last week',
    ],
    preferOverSql: true,
  },
  {
    name: 'get_sales_kpis',
    domain: 'analytics',
    description: 'Revenue, order count, and gross profit for a single NZ period. Matches dashboard/accounting logic.',
    argsHint: '{ "period": "last_30d" } — same period keys as compare_sales_periods',
    examples: ['What was revenue last 30 days?', 'Gross profit this month', 'Sales today'],
    preferOverSql: true,
  },
  {
    name: 'orders_for_day',
    domain: 'calendar',
    description: 'Orders scheduled for delivery on a specific day, optionally filtered by region (AKL/WLG).',
    argsHint: '{ "date": "2025-06-24", "region": "AKL" } — date defaults to today NZ; region optional',
    examples: ['How many deliveries tomorrow?', 'Wellington orders for Friday', 'Out the door today'],
    preferOverSql: true,
  },
  {
    name: 'staff_on_shift',
    domain: 'operations',
    description: 'Who is currently clocked in (active shifts with no clock-out).',
    argsHint: '{}',
    examples: ['Who is clocked in right now?', 'Who is working today?'],
    preferOverSql: true,
  },
  {
    name: 'fcp_tasks_today',
    domain: 'compliance',
    description: 'FCP (food safety) tasks due today or overdue this week.',
    argsHint: '{}',
    examples: ['What FCP tasks are due today?', 'Any open food safety tasks?'],
    preferOverSql: true,
  },
  {
    name: 'sql_query',
    domain: 'fallback',
    description:
      'LAST RESORT only — ad-hoc read-only SQL when no typed tool fits. Never use for sales, revenue, profit, or order lookups.',
    argsHint: '{ "sql": "SELECT ... LIMIT 10" }',
    examples: [],
    preferOverSql: false,
  },
]

export function buildToolRegistryPrompt(): string {
  const lines = AI_TOOLS.map(
    (t, i) =>
      `${i + 1}. ${t.name} [${t.domain}] — ${t.description}\n   args: ${t.argsHint}`,
  )
  return `Available tools (pick exactly ONE):\n\n${lines.join('\n\n')}`
}

export const ROUTER_RULES = [
  'NEVER ask clarifying questions — pick the best tool with reasonable assumptions.',
  'Phone/email/name → search_people',
  'Order lookup/status/delivery → lookup_order',
  'Update/change order fields → propose_order_update (never apply directly)',
  'Print labels → print_labels',
  'Allergen/dietary → check_allergen',
  'Sales/revenue/profit comparisons or trends → compare_sales_periods or get_sales_kpis (NEVER sql_query)',
  'Deliveries scheduled for a day → orders_for_day',
  'Clocked in / on shift → staff_on_shift',
  'FCP / food safety tasks → fcp_tasks_today',
  'sql_query ONLY when nothing else fits — never for sales, orders, or people.',
].join('\n')
