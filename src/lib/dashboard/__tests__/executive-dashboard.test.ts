import assert from 'node:assert/strict'
import { parseExecutiveFilters } from '../executive-filters'
import {
  CompanyRollup,
  classifyGrowthOpportunity,
  companyStatusFromDates,
  diffDays,
  recommendedAction,
  toCurrency,
} from '../common'
import {
  aggregateCompanyTotalsFromRows,
  computeAverageOrdersPerCompany,
  computeRevenueByCompanyOrderNumber,
  countActiveCompaniesInOrders,
  isNewCompanyInPeriod,
  isPrivateUnmatchedCompanyName,
  isReturningCompanyInPeriod,
} from '../company-analytics'
import { lineItemRevenue } from '../product-analytics'

function buildCompany(overrides: Partial<CompanyRollup>): CompanyRollup {
  return {
    companyId: 'cmp_1',
    companyName: 'Xero',
    lifetimeRevenue: 12000,
    lifetimeOrders: 6,
    avgOrderValue: 2000,
    firstOrderDate: new Date('2025-01-10T00:00:00.000Z'),
    lastOrderDate: new Date('2026-05-01T00:00:00.000Z'),
    daysSinceLastOrder: 30,
    contacts: 3,
    confidenceScore: 95,
    primaryDomain: 'xero.com',
    primaryAddress: '19 Morgan St, Wellington',
    status: 'active',
    periodRevenue: 4000,
    periodOrders: 2,
    isNewInPeriod: false,
    isReturningInPeriod: true,
    ...overrides,
  }
}

function run() {
  const end = new Date('2026-05-31T00:00:00.000Z')
  const first = new Date('2026-05-10T00:00:00.000Z')
  const last = new Date('2026-05-20T00:00:00.000Z')
  assert.equal(companyStatusFromDates(first, last, end, true, null), 'new')

  const atRiskLast = new Date('2026-02-15T00:00:00.000Z')
  assert.equal(companyStatusFromDates(new Date('2024-01-01'), atRiskLast, end, false, null), 'at_risk')

  const lapsedLast = new Date('2025-10-01T00:00:00.000Z')
  assert.equal(companyStatusFromDates(new Date('2024-01-01'), lapsedLast, end, false, null), 'lapsed')

  assert.equal(
    companyStatusFromDates(new Date('2024-01-01'), new Date('2026-05-25'), end, true, 220),
    'reactivated'
  )

  const highValueSingle = buildCompany({ lifetimeOrders: 1, lifetimeRevenue: 1500, avgOrderValue: 1500 })
  assert.equal(classifyGrowthOpportunity(highValueSingle).opportunityType, 'High-value single order')
  assert.equal(recommendedAction(highValueSingle), 'Invite to corporate account')

  const atRiskCompany = buildCompany({ status: 'at_risk', lifetimeRevenue: 3000, lifetimeOrders: 3, avgOrderValue: 1000 })
  assert.equal(classifyGrowthOpportunity(atRiskCompany).opportunityType, 'At-risk valuable company')

  const lapsedCompany = buildCompany({ status: 'lapsed', lifetimeRevenue: 7000, lifetimeOrders: 5, avgOrderValue: 1400 })
  assert.equal(classifyGrowthOpportunity(lapsedCompany).opportunityType, 'Lapsed high-value company')

  const multiContact = buildCompany({ contacts: 4, lifetimeRevenue: 3500, lifetimeOrders: 3, avgOrderValue: 900 })
  assert.equal(classifyGrowthOpportunity(multiContact).opportunityType, 'Multi-contact expansion account')

  const freqBuyer = buildCompany({ lifetimeOrders: 5, lifetimeRevenue: 4000, avgOrderValue: 800, contacts: 1 })
  assert.equal(classifyGrowthOpportunity(freqBuyer).opportunityType, 'Frequent buyer')

  const buckets = computeRevenueByCompanyOrderNumber(
    [
      { companyId: 'xero', shopifyOrderId: '1', shopifyCustomerId: 'a', orderDate: new Date('2026-01-01'), orderTotal: 100, products: [] },
      { companyId: 'xero', shopifyOrderId: '2', shopifyCustomerId: 'a', orderDate: new Date('2026-02-01'), orderTotal: 150, products: [] },
      { companyId: 'xero', shopifyOrderId: '3', shopifyCustomerId: 'a', orderDate: new Date('2026-03-01'), orderTotal: 200, products: [] },
      { companyId: 'xero', shopifyOrderId: '4', shopifyCustomerId: 'a', orderDate: new Date('2026-04-01'), orderTotal: 250, products: [] },
    ],
    new Date('2026-01-01'),
    new Date('2026-12-31')
  )
  assert.equal(buckets.find((row) => row.bucket === '1st order')?.revenue, 100)
  assert.equal(buckets.find((row) => row.bucket === '4th+ order')?.orders, 1)

  const params = new URLSearchParams()
  params.set('preset', 'custom')
  params.set('startDate', '2026-01-01')
  params.set('endDate', '2026-06-30')
  params.set('minConfidence', '80')
  params.set('companyStatus', 'active')
  params.set('revenueTier', '5000_9999')
  const parsed = parseExecutiveFilters(params)
  assert.equal(parsed.companyStatus, 'active')
  assert.equal(parsed.minConfidence, 80)
  assert.equal(parsed.revenueTier, '5000_9999')
  assert.equal(parsed.includePrivateUnmatched, false)
  assert.ok(parsed.startDate <= parsed.endDate)

  params.set('includePrivateUnmatched', 'true')
  const parsedWithPrivate = parseExecutiveFilters(params)
  assert.equal(parsedWithPrivate.includePrivateUnmatched, true)

  assert.equal(diffDays(new Date('2026-01-01'), new Date('2026-01-11')), 10)
  assert.equal(toCurrency(NaN), 0)
  assert.equal(toCurrency(123.456), 123.46)

  assert.equal(isPrivateUnmatchedCompanyName('Private Customer'), true)
  assert.equal(isPrivateUnmatchedCompanyName('Xero'), false)

  assert.equal(
    isNewCompanyInPeriod(new Date('2026-05-10T00:00:00.000Z'), new Date('2026-05-01'), new Date('2026-05-31')),
    true
  )
  assert.equal(
    isReturningCompanyInPeriod(new Date('2026-01-10T00:00:00.000Z'), new Date('2026-05-01'), true),
    true
  )
  assert.equal(
    countActiveCompaniesInOrders([
      { companyId: 'a' },
      { companyId: 'a' },
      { companyId: 'b' },
      { companyId: 'c' },
    ]),
    3
  )
  assert.equal(toCurrency(computeAverageOrdersPerCompany(9, 3)), 3)

  // Product parsing + revenue reconciliation sanity checks
  const parsedLineItemRevenue =
    lineItemRevenue({ quantity: 2, price: '50' }) + lineItemRevenue({ line_price: '75', quantity: 1 })
  assert.equal(parsedLineItemRevenue, 175)
  const orderTotal = 180
  assert.ok(parsedLineItemRevenue / orderTotal > 0.9)

  // Domain rollup: multiple customers on same business domain should collapse to one company rollup.
  const domainRollup = aggregateCompanyTotalsFromRows([
    {
      companyId: 'cmp_old_1',
      domain: 'grindinggear.com',
      shopifyOrderId: 'o1',
      orderTotal: 50000,
      customerKey: 'office@grindinggear.com',
    },
    {
      companyId: 'cmp_old_2',
      domain: 'grindinggear.com',
      shopifyOrderId: 'o2',
      orderTotal: 61187,
      customerKey: 'events@grindinggear.com',
    },
    {
      companyId: 'cmp_old_2',
      domain: 'grindinggear.com',
      shopifyOrderId: 'o2',
      orderTotal: 61187,
      customerKey: 'events@grindinggear.com',
    },
  ])
  assert.equal(domainRollup.length, 1)
  assert.equal(domainRollup[0].key, 'domain:grindinggear.com')
  assert.equal(domainRollup[0].orders, 2)
  assert.equal(domainRollup[0].revenue, 111187)
  assert.equal(domainRollup[0].contacts, 2)

  // Generic domains should not be merged into one business-domain rollup.
  const genericRollup = aggregateCompanyTotalsFromRows([
    {
      companyId: 'private_1',
      domain: 'gmail.com',
      shopifyOrderId: 'g1',
      orderTotal: 100,
      customerKey: 'person1@gmail.com',
    },
    {
      companyId: 'private_2',
      domain: 'gmail.com',
      shopifyOrderId: 'g2',
      orderTotal: 200,
      customerKey: 'person2@gmail.com',
    },
  ])
  assert.equal(genericRollup.length, 2)
  assert.ok(genericRollup.some((row) => row.key === 'company:private_1'))
  assert.ok(genericRollup.some((row) => row.key === 'company:private_2'))

  // Growth opportunities: high-value repeat companies should be key accounts.
  const keyAccount = buildCompany({
    lifetimeOrders: 36,
    lifetimeRevenue: 111187,
    avgOrderValue: 3088.53,
    contacts: 4,
  })
  assert.equal(classifyGrowthOpportunity(keyAccount).opportunityType, 'VIP / Key Account')

  // Missing data handling sanity
  const missing = buildCompany({
    firstOrderDate: null,
    lastOrderDate: null,
    daysSinceLastOrder: null,
    primaryDomain: null,
  })
  assert.equal(recommendedAction(missing), 'Assign account manager')

  console.log('executive dashboard tests passed')
}

run()
