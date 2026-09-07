import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { parseAndUpsertCompanyForOrder } from '../src/lib/company-matching'

async function run() {
  if (!process.env.RUN_DB_IDEMPOTENCY_TEST) {
    console.log('Skipping DB idempotency test (set RUN_DB_IDEMPOTENCY_TEST=1 to enable)')
    return
  }

  const suffix = `test-${Date.now()}`
  const shopifyOrderId = `company-idempotency-${suffix}`
  const email = `ops+${suffix}@example-biz.co.nz`

  const payload = {
    id: shopifyOrderId,
    name: '#999999',
    note: 'idempotency test',
    total_discounts: '0',
    customer: {
      id: `cust-${suffix}`,
      email,
      first_name: 'Idem',
      last_name: 'Potent',
    },
    shipping_address: {
      company: 'Example Biz NZ',
      address1: 'Level 4, 19 Morgan Street',
      city: 'Wellington',
      country: 'New Zealand',
    },
    billing_address: {
      company: 'Example Biz NZ Limited',
      address1: 'L4 / 19 Morgan St',
      city: 'Wellington',
      country: 'New Zealand',
    },
    source_name: 'web',
  }

  const transformed = {
    shopifyId: shopifyOrderId,
    orderNumber: '999999',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalPrice: 150,
    subtotalPrice: 150,
    customerEmail: email,
    customerFirstName: 'Idem',
    customerLastName: 'Potent',
    customerPhone: null,
    shippingAddress: payload.shipping_address,
    lineItems: [{ title: 'Test product', quantity: 1 }],
    notes: 'idempotency test',
    source: 'shopify',
  }

  await parseAndUpsertCompanyForOrder({ shopifyOrder: payload, transformedOrder: transformed })
  await parseAndUpsertCompanyForOrder({ shopifyOrder: payload, transformedOrder: transformed })

  const orders = await prisma.companyOrder.findMany({ where: { shopifyOrderId } })
  assert.equal(orders.length, 1, 'Expected one upserted company_order row')

  const order = orders[0]
  assert.ok(order.companyId, 'Expected order to be linked to a company')

  console.log('company upsert idempotency test passed')
}

run()
  .catch((error) => {
    console.error('company upsert idempotency test failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
