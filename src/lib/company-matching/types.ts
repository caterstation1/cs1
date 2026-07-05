export type CompanyMatchMethod =
  | 'domain_exact'
  | 'name_exact'
  | 'name_and_address'
  | 'domain_and_address'
  | 'address_exact'
  | 'fuzzy'
  | 'fuzzy_reviewed'
  | 'private_customer'
  | 'unmatched'
  | 'new_company'

export interface CompanyIdentityInput {
  shopifyOrderId: string
  shopifyCustomerId?: string | null
  customerFirstName?: string | null
  customerLastName?: string | null
  email?: string | null
  phone?: string | null
  shippingCompany?: string | null
  billingCompany?: string | null
  shippingAddress?: unknown
  billingAddress?: unknown
  orderNote?: string | null
  customerTags?: string[] | null
}

export interface CompanyRecordCandidate {
  companyId: string
  canonicalCompanyName: string
  companyNameVariants: string[]
  primaryDomain?: string | null
  alternateDomains?: string[]
  primaryAddress?: unknown
  city?: string | null
  region?: string | null
  country?: string | null
}

export interface CompanyMatchResult {
  method: CompanyMatchMethod
  confidenceScore: number
  requiresManualReview: boolean
  matchReason: string
  matchedCompanyId?: string
  proposedCompanyName: string
  normalizedCompanyName: string
  domain?: string | null
  normalizedAddress?: string | null
}
