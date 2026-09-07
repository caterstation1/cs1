import { env } from '@/env.mjs'
import type { VoucherTemplate } from '@/lib/lifecycle/voucher-templates'

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message: string }>
}

type DiscountItemsSelection = Record<string, unknown>

type SourceDiscount =
  | {
      kind: 'basic'
      nodeId: string
      title: string
      customerGets: Record<string, unknown>
      minimumRequirement?: Record<string, unknown>
      combinesWith?: Record<string, unknown>
      appliesOncePerCustomer?: boolean
      usageLimit?: number | null
    }
  | {
      kind: 'bxgy'
      nodeId: string
      title: string
      customerBuys: Record<string, unknown>
      customerGets: Record<string, unknown>
      combinesWith?: Record<string, unknown>
      usesPerOrderLimit?: number | null
    }

const SOURCE_DISCOUNT_QUERY = `query SourceDiscount($code: String!) {
  codeDiscountNodeByCode(code: $code) {
    id
    codeDiscount {
      __typename
      ... on DiscountCodeBasic {
        title
        combinesWith { orderDiscounts productDiscounts shippingDiscounts }
        minimumRequirement {
          __typename
          ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
          ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
        }
        customerGets {
          value {
            __typename
            ... on DiscountPercentage { percentage }
            ... on DiscountAmount { amount { amount } appliesOnEachItem }
          }
          items {
            __typename
            ... on AllDiscountItems { allItems }
            ... on DiscountProducts { products(first: 100) { nodes { id } } }
            ... on DiscountCollections { collections(first: 100) { nodes { id } } }
          }
        }
        appliesOncePerCustomer
        usageLimit
      }
      ... on DiscountCodeBxgy {
        title
        combinesWith { orderDiscounts productDiscounts shippingDiscounts }
        customerBuys {
          items {
            __typename
            ... on AllDiscountItems { allItems }
            ... on DiscountProducts { products(first: 100) { nodes { id } } }
            ... on DiscountCollections { collections(first: 100) { nodes { id } } }
          }
          value {
            __typename
            ... on DiscountQuantity { quantity }
            ... on DiscountPurchaseAmount { amount }
          }
        }
        customerGets {
          items {
            __typename
            ... on AllDiscountItems { allItems }
            ... on DiscountProducts { products(first: 100) { nodes { id } } }
            ... on DiscountCollections { collections(first: 100) { nodes { id } } }
          }
          value {
            __typename
            ... on DiscountPercentage { percentage }
            ... on DiscountOnQuantity {
              quantity { quantity }
              effect {
                __typename
                ... on DiscountPercentage { percentage }
              }
            }
          }
        }
        usesPerOrderLimit
      }
    }
  }
}`

async function shopifyGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const shopUrl = env.SHOPIFY_SHOP_URL
  const accessToken = env.SHOPIFY_ACCESS_TOKEN
  const apiVersion = env.SHOPIFY_API_VERSION

  const response = await fetch(`https://${shopUrl}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Shopify GraphQL error ${response.status}: ${text}`)
  }

  const payload = (await response.json()) as GraphqlResponse<T>
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((row) => row.message).join('; '))
  }
  if (!payload.data) {
    throw new Error('Shopify GraphQL returned no data')
  }
  return payload.data
}

function toCustomerGid(shopifyCustomerId: string): string {
  const raw = String(shopifyCustomerId || '').trim()
  if (!raw) throw new Error('Missing Shopify customer id')
  if (raw.startsWith('gid://')) return raw
  return `gid://shopify/Customer/${raw}`
}

function mapDiscountItems(items: any): DiscountItemsSelection {
  if (!items || typeof items !== 'object') return { all: true }
  if (items.__typename === 'AllDiscountItems' || items.allItems) return { all: true }

  const productIds = Array.isArray(items.products?.nodes)
    ? items.products.nodes.map((row: any) => row.id).filter(Boolean)
    : []
  if (productIds.length) {
    return { products: { productsToAdd: productIds } }
  }

  const collectionIds = Array.isArray(items.collections?.nodes)
    ? items.collections.nodes.map((row: any) => row.id).filter(Boolean)
    : []
  if (collectionIds.length) {
    return { collections: { collectionsToAdd: collectionIds } }
  }

  return { all: true }
}

function mapMinimumRequirement(minimumRequirement: any): Record<string, unknown> | undefined {
  if (!minimumRequirement || typeof minimumRequirement !== 'object') return undefined
  if (minimumRequirement.__typename === 'DiscountMinimumSubtotal') {
    const subtotalAmount =
      minimumRequirement.greaterThanOrEqualToSubtotal?.amount ??
      minimumRequirement.greaterThanOrEqualToSubtotal
    return {
      subtotal: {
        greaterThanOrEqualToSubtotal: String(subtotalAmount),
      },
    }
  }
  if (minimumRequirement.__typename === 'DiscountMinimumQuantity') {
    return {
      quantity: {
        greaterThanOrEqualToQuantity: String(minimumRequirement.greaterThanOrEqualToQuantity),
      },
    }
  }
  return undefined
}

function mapBasicCustomerGetsValue(value: any): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Source discount is missing customerGets value')
  }
  if (value.__typename === 'DiscountPercentage') {
    return { percentage: Number(value.percentage || 0) }
  }
  if (value.__typename === 'DiscountAmount') {
    const amountValue = value.amount?.amount ?? value.amount
    return {
      discountAmount: {
        amount: Number(amountValue || 0),
        appliesOnEachItem: Boolean(value.appliesOnEachItem),
      },
    }
  }
  throw new Error(`Unsupported source discount value type: ${value.__typename || 'unknown'}`)
}

function mapBxgyCustomerBuysValue(value: any): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Source BXGY discount is missing customerBuys value')
  }
  if (value.__typename === 'DiscountQuantity') {
    return { quantity: String(value.quantity) }
  }
  if (value.__typename === 'DiscountPurchaseAmount') {
    return { amount: String(value.amount) }
  }
  throw new Error(`Unsupported source BXGY buy value type: ${value.__typename || 'unknown'}`)
}

function mapBxgyCustomerGetsValue(value: any): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Source BXGY discount is missing customerGets value')
  }
  if (value.__typename === 'DiscountPercentage') {
    return { percentage: Number(value.percentage || 0) }
  }
  if (value.__typename === 'DiscountOnQuantity') {
    const quantity = Number(value.quantity?.quantity || 0)
    const percentage = Number(value.effect?.percentage || 0)
    return {
      discountOnQuantity: {
        quantity: String(quantity),
        effect: { percentage },
      },
    }
  }
  throw new Error(`Unsupported source BXGY get value type: ${value.__typename || 'unknown'}`)
}

async function fetchSourceDiscountByCode(code: string): Promise<SourceDiscount> {
  const normalizedCode = String(code || '').trim()
  if (!normalizedCode) {
    throw new Error('Shopify source discount code is required')
  }

  const data = await shopifyGraphql<{
    codeDiscountNodeByCode: {
      id: string
      codeDiscount: any
    } | null
  }>(SOURCE_DISCOUNT_QUERY, { code: normalizedCode })

  const node = data.codeDiscountNodeByCode
  if (!node?.codeDiscount) {
    throw new Error(`Shopify source discount not found for code ${normalizedCode}`)
  }

  const discount = node.codeDiscount
  if (discount.__typename === 'DiscountCodeBasic') {
    return {
      kind: 'basic',
      nodeId: node.id,
      title: String(discount.title || normalizedCode),
      customerGets: {
        value: mapBasicCustomerGetsValue(discount.customerGets?.value),
        items: mapDiscountItems(discount.customerGets?.items),
      },
      minimumRequirement: mapMinimumRequirement(discount.minimumRequirement),
      combinesWith: discount.combinesWith || undefined,
      appliesOncePerCustomer: discount.appliesOncePerCustomer !== false,
      usageLimit: discount.usageLimit ?? 1,
    }
  }

  if (discount.__typename === 'DiscountCodeBxgy') {
    return {
      kind: 'bxgy',
      nodeId: node.id,
      title: String(discount.title || normalizedCode),
      customerBuys: {
        items: mapDiscountItems(discount.customerBuys?.items),
        value: mapBxgyCustomerBuysValue(discount.customerBuys?.value),
      },
      customerGets: {
        items: mapDiscountItems(discount.customerGets?.items),
        value: mapBxgyCustomerGetsValue(discount.customerGets?.value),
      },
      combinesWith: discount.combinesWith || undefined,
      usesPerOrderLimit: discount.usesPerOrderLimit ?? null,
    }
  }

  throw new Error(
    `Unsupported Shopify source discount type: ${discount.__typename || 'unknown'}. Use a Basic or Buy X Get Y code discount in Shopify.`
  )
}

async function cloneSourceDiscountForCustomer(input: {
  source: SourceDiscount
  code: string
  customerGid: string
  endsAt: Date
  title?: string
}): Promise<{ discountNodeId: string; code: string; sourceNodeId: string }> {
  const startsAt = new Date()
  const shared = {
    title: input.title || input.source.title,
    code: input.code,
    startsAt: startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    customerSelection: {
      customers: {
        add: [input.customerGid],
      },
    },
  }

  if (input.source.kind === 'basic') {
    const data = await shopifyGraphql<{
      discountCodeBasicCreate: {
        codeDiscountNode: { id: string } | null
        userErrors: Array<{ message: string }>
      }
    }>(
      `mutation CloneBasicDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`,
      {
        basicCodeDiscount: {
          ...shared,
          customerGets: input.source.customerGets,
          appliesOncePerCustomer: input.source.appliesOncePerCustomer ?? true,
          usageLimit: input.source.usageLimit ?? 1,
          ...(input.source.minimumRequirement ? { minimumRequirement: input.source.minimumRequirement } : {}),
          ...(input.source.combinesWith ? { combinesWith: input.source.combinesWith } : {}),
        },
      }
    )

    const result = data.discountCodeBasicCreate
    if (result.userErrors?.length) {
      throw new Error(result.userErrors.map((row) => row.message).join('; '))
    }
    if (!result.codeDiscountNode?.id) {
      throw new Error('Shopify did not return a cloned basic discount id')
    }
    return {
      discountNodeId: result.codeDiscountNode.id,
      code: input.code,
      sourceNodeId: input.source.nodeId,
    }
  }

  const data = await shopifyGraphql<{
    discountCodeBxgyCreate: {
      codeDiscountNode: { id: string } | null
      userErrors: Array<{ message: string }>
    }
  }>(
    `mutation CloneBxgyDiscount($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
      discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      bxgyCodeDiscount: {
        ...shared,
        customerBuys: input.source.customerBuys,
        customerGets: input.source.customerGets,
        ...(input.source.combinesWith ? { combinesWith: input.source.combinesWith } : {}),
        ...(input.source.usesPerOrderLimit != null ? { usesPerOrderLimit: input.source.usesPerOrderLimit } : {}),
      },
    }
  )

  const result = data.discountCodeBxgyCreate
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((row) => row.message).join('; '))
  }
  if (!result.codeDiscountNode?.id) {
    throw new Error('Shopify did not return a cloned BXGY discount id')
  }

  return {
    discountNodeId: result.codeDiscountNode.id,
    code: input.code,
    sourceNodeId: input.source.nodeId,
  }
}

export async function findShopifyCustomerGid(input: {
  email?: string | null
  shopifyCustomerId?: string | null
}): Promise<string | null> {
  if (input.shopifyCustomerId) {
    return toCustomerGid(input.shopifyCustomerId)
  }
  const email = String(input.email || '').trim().toLowerCase()
  if (!email) return null

  const data = await shopifyGraphql<{
    customers: { nodes: Array<{ id: string; email: string }> }
  }>(
    `query FindCustomerByEmail($query: String!) {
      customers(first: 1, query: $query) {
        nodes { id email }
      }
    }`,
    { query: `email:${email}` }
  )

  return data.customers.nodes[0]?.id || null
}

export async function provisionShopifyVoucherForCustomer(input: {
  template: VoucherTemplate
  code: string
  email?: string | null
  shopifyCustomerId?: string | null
  endsAt: Date
  title?: string
}): Promise<{ discountNodeId: string; code: string; customerGid: string; sourceNodeId: string }> {
  const sourceCode = String(input.template.shopifySourceCode || input.template.codePrefix || '').trim()
  const customerGid = await findShopifyCustomerGid({
    email: input.email,
    shopifyCustomerId: input.shopifyCustomerId,
  })
  if (!customerGid) {
    throw new Error('Customer not found in Shopify — cannot create a customer-specific voucher')
  }

  const source = await fetchSourceDiscountByCode(sourceCode)
  const created = await cloneSourceDiscountForCustomer({
    source,
    code: input.code,
    customerGid,
    endsAt: input.endsAt,
    title: input.title,
  })

  return {
    ...created,
    customerGid,
  }
}
