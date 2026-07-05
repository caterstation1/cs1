import assert from 'node:assert/strict'
import {
  extractBusinessDomain,
  matchCompany,
  normalizeAddress,
  normalizeCompanyName,
} from './index'

function runTests() {
  // Domain extraction and generic filtering
  assert.equal(extractBusinessDomain('jane@xero.com'), 'xero.com')
  assert.equal(extractBusinessDomain('ops@mail.spark.co.nz'), 'spark.co.nz')
  assert.equal(extractBusinessDomain('user@gmail.com'), null)
  assert.equal(extractBusinessDomain('user@xtra.co.nz'), null)
  assert.equal(extractBusinessDomain('user@hotmail.co.nz'), null)
  assert.equal(extractBusinessDomain('user@yahoo.co.nz'), null)
  assert.equal(extractBusinessDomain('user@net.nz'), null)
  assert.equal(extractBusinessDomain('user@school.nz'), null)

  // Name normalization variants
  assert.equal(normalizeCompanyName('Xero NZ Limited'), 'xero')
  assert.equal(normalizeCompanyName('Air New Zealand Ltd.'), 'air')
  assert.equal(normalizeCompanyName('Spark Co. New Zealand'), 'spark')

  // Address normalization (supportive matcher evidence)
  assert.equal(
    normalizeAddress({ address1: 'Level 4, 19 Morgan Street', city: 'Wellington' }),
    normalizeAddress({ address1: 'L4 / 19 Morgan St', city: 'Wellington' })
  )

  const existingCompanies = [
    {
      companyId: 'cmp_xero',
      canonicalCompanyName: 'Xero',
      companyNameVariants: ['Xero', 'Xero NZ'],
      primaryDomain: 'xero.com',
      alternateDomains: [],
      primaryAddress: { address1: '19 Morgan St', city: 'Wellington' },
      city: 'Wellington',
      region: 'WLG',
      country: 'NZ',
    },
  ]

  // Priority 1: exact domain match
  const domainDecision = matchCompany(
    {
      shopifyOrderId: '1001',
      email: 'ops@xero.com',
      shippingCompany: 'Xero New Zealand',
    },
    existingCompanies
  )
  assert.equal(domainDecision.method, 'domain_exact')
  assert.equal(domainDecision.confidenceScore, 100)
  assert.equal(domainDecision.requiresManualReview, false)
  assert.equal(domainDecision.matchedCompanyId, 'cmp_xero')

  // Priority 4: fuzzy below threshold routes to review queue
  const fuzzyDecision = matchCompany(
    {
      shopifyOrderId: '1002',
      email: 'somebody@yahoo.com',
      shippingCompany: 'Xeroo',
    },
    existingCompanies
  )
  assert.equal(fuzzyDecision.method, 'fuzzy_reviewed')
  assert.equal(fuzzyDecision.confidenceScore, 70)
  assert.equal(fuzzyDecision.requiresManualReview, true)

  // Idempotency proxy: repeated input yields stable decision
  const repeatDecision = matchCompany(
    {
      shopifyOrderId: '1002',
      email: 'somebody@yahoo.com',
      shippingCompany: 'Xeroo',
    },
    existingCompanies
  )
  assert.deepEqual(
    { method: fuzzyDecision.method, score: fuzzyDecision.confidenceScore, company: fuzzyDecision.matchedCompanyId },
    { method: repeatDecision.method, score: repeatDecision.confidenceScore, company: repeatDecision.matchedCompanyId }
  )

  const privateDecision = matchCompany(
    {
      shopifyOrderId: '1003',
      email: 'someone@gmail.com',
      shippingCompany: '',
      billingCompany: '',
      shippingAddress: null,
      billingAddress: null,
    },
    existingCompanies
  )
  assert.equal(privateDecision.method, 'private_customer')

  console.log('company-matching tests passed')
}

runTests()
