import {
  CompanyIdentityInput,
  CompanyMatchResult,
  CompanyRecordCandidate,
} from './types'
import {
  domainToCompanyName,
  extractBusinessDomain,
  extractEmailRootDomain,
  isGenericEmailDomain,
  normalizeAddress,
  normalizeCompanyName,
} from './normalization'
import { addressSimilarityScore, similarityScore } from './scoring'

function normalizeVariants(company: CompanyRecordCandidate): string[] {
  const variants = [
    company.canonicalCompanyName,
    ...(Array.isArray(company.companyNameVariants) ? company.companyNameVariants : []),
  ]
    .map((name) => normalizeCompanyName(name))
    .filter(Boolean)
  return Array.from(new Set(variants))
}

function companyDomains(company: CompanyRecordCandidate): string[] {
  const domains = [
    company.primaryDomain || '',
    ...(Array.isArray(company.alternateDomains) ? company.alternateDomains : []),
  ]
    .map((d) => d.toLowerCase().trim())
    .filter(Boolean)
  return Array.from(new Set(domains))
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim().length > 0) return value.trim()
  }
  return ''
}

function bestFuzzyMatch(
  normalizedName: string,
  companies: CompanyRecordCandidate[]
): { candidate: CompanyRecordCandidate; score: number } | null {
  let winner: { candidate: CompanyRecordCandidate; score: number } | null = null
  for (const company of companies) {
    const scores = normalizeVariants(company).map((variant) => similarityScore(normalizedName, variant))
    const score = scores.length ? Math.max(...scores) : 0
    if (!winner || score > winner.score) winner = { candidate: company, score }
  }
  return winner
}

function resolveAddress(
  shippingAddress: unknown,
  billingAddress: unknown
): string {
  return normalizeAddress(shippingAddress) || normalizeAddress(billingAddress)
}

export function matchCompany(
  input: CompanyIdentityInput,
  existingCompanies: CompanyRecordCandidate[],
  options?: {
    genericDomains?: Set<string>
  }
): CompanyMatchResult {
  const rootEmailDomain = extractEmailRootDomain(input.email)
  const genericDomains = options?.genericDomains || new Set<string>()
  const emailDomainIsGeneric =
    (rootEmailDomain ? genericDomains.has(rootEmailDomain) : false) ||
    isGenericEmailDomain(rootEmailDomain)
  const domain = emailDomainIsGeneric ? null : extractBusinessDomain(input.email)
  const rawCompanyName = firstNonEmpty(input.shippingCompany, input.billingCompany)
  const normalizedName =
    normalizeCompanyName(rawCompanyName) || (domain ? normalizeCompanyName(domainToCompanyName(domain)) : '')
  const normalizedAddr = resolveAddress(input.shippingAddress, input.billingAddress)

  // Priority 1: exact business domain match.
  if (domain) {
    const domainMatch = existingCompanies.find((company) => companyDomains(company).includes(domain))
    if (domainMatch) {
      if (normalizedAddr) {
        const existingAddress = normalizeAddress(domainMatch.primaryAddress)
        if (existingAddress && addressSimilarityScore(normalizedAddr, existingAddress) >= 0.88) {
          return {
            method: 'domain_and_address',
            confidenceScore: 100,
            requiresManualReview: false,
            matchReason: `Exact business domain and matching address (${domain})`,
            matchedCompanyId: domainMatch.companyId,
            proposedCompanyName: domainMatch.canonicalCompanyName,
            normalizedCompanyName: normalizeCompanyName(domainMatch.canonicalCompanyName),
            domain,
            normalizedAddress: normalizedAddr,
          }
        }
      }
      return {
        method: 'domain_exact',
        confidenceScore: 100,
        requiresManualReview: false,
        matchReason: `Exact business domain match (${domain})`,
        matchedCompanyId: domainMatch.companyId,
        proposedCompanyName: domainMatch.canonicalCompanyName,
        normalizedCompanyName: normalizeCompanyName(domainMatch.canonicalCompanyName),
        domain,
        normalizedAddress: normalizedAddr || null,
      }
    }

    return {
      method: 'domain_exact',
      confidenceScore: 100,
      requiresManualReview: false,
      matchReason: `New company inferred from business domain (${domain})`,
      proposedCompanyName: domainToCompanyName(domain),
      normalizedCompanyName: normalizeCompanyName(domainToCompanyName(domain)),
      domain,
      normalizedAddress: normalizedAddr || null,
    }
  }

  // Priority 2: exact normalized company-name match.
  if (normalizedName) {
    const nameMatch = existingCompanies.find((company) => normalizeVariants(company).includes(normalizedName))
    if (nameMatch) {
      const existingAddress = normalizeAddress(nameMatch.primaryAddress)
      if (normalizedAddr && existingAddress && addressSimilarityScore(normalizedAddr, existingAddress) >= 0.88) {
        return {
          method: 'name_and_address',
          confidenceScore: 90,
          requiresManualReview: false,
          matchReason: 'Normalized company name and address matched',
          matchedCompanyId: nameMatch.companyId,
          proposedCompanyName: nameMatch.canonicalCompanyName,
          normalizedCompanyName: normalizeCompanyName(nameMatch.canonicalCompanyName),
          domain: null,
          normalizedAddress: normalizedAddr,
        }
      }
      return {
        method: 'name_exact',
        confidenceScore: 95,
        requiresManualReview: false,
        matchReason: 'Exact normalized company name match',
        matchedCompanyId: nameMatch.companyId,
        proposedCompanyName: nameMatch.canonicalCompanyName,
        normalizedCompanyName: normalizeCompanyName(nameMatch.canonicalCompanyName),
        domain: null,
        normalizedAddress: normalizedAddr || null,
      }
    }
  }

  // Priority 3: address-only support match.
  if (normalizedAddr) {
    const addressMatch = existingCompanies.find((company) => {
      const existingAddress = normalizeAddress(company.primaryAddress)
      return existingAddress && addressSimilarityScore(normalizedAddr, existingAddress) >= 0.94
    })
    if (addressMatch) {
      return {
        method: 'address_exact',
        confidenceScore: 80,
        requiresManualReview: false,
        matchReason: 'Exact normalized address match',
        matchedCompanyId: addressMatch.companyId,
        proposedCompanyName: addressMatch.canonicalCompanyName,
        normalizedCompanyName: normalizeCompanyName(addressMatch.canonicalCompanyName),
        domain: null,
        normalizedAddress: normalizedAddr,
      }
    }
  }

  // Priority 4: fuzzy matching.
  if (normalizedName) {
    const fuzzy = bestFuzzyMatch(normalizedName, existingCompanies)
    if (fuzzy && fuzzy.score >= 0.75) {
      const confidenceScore = 70
      return {
        method: 'fuzzy_reviewed',
        confidenceScore,
        requiresManualReview: true,
        matchReason: `Strong fuzzy match (${Math.round(fuzzy.score * 100)}%)`,
        matchedCompanyId: fuzzy.candidate.companyId,
        proposedCompanyName: fuzzy.candidate.canonicalCompanyName,
        normalizedCompanyName: normalizeCompanyName(fuzzy.candidate.canonicalCompanyName),
        domain: null,
        normalizedAddress: normalizedAddr || null,
      }
    }
  }

  const isGenericOrMissingDomain = !rootEmailDomain || emailDomainIsGeneric
  if (isGenericOrMissingDomain && !normalizedName && !normalizedAddr) {
    return {
      method: 'private_customer',
      confidenceScore: 40,
      requiresManualReview: false,
      matchReason: 'private_customer:no_business_domain_or_company_signal',
      proposedCompanyName: 'Private Customer',
      normalizedCompanyName: 'private customer',
      domain: null,
      normalizedAddress: null,
    }
  }

  if (isGenericOrMissingDomain) {
    return {
      method: 'unmatched',
      confidenceScore: 45,
      requiresManualReview: true,
      matchReason: 'unmatched:generic_or_missing_domain',
      proposedCompanyName: rawCompanyName || 'Unmatched Customer',
      normalizedCompanyName: normalizeCompanyName(rawCompanyName || 'unmatched customer'),
      domain: null,
      normalizedAddress: normalizedAddr || null,
    }
  }

  const fallbackName = rawCompanyName || domainToCompanyName(domain)
  return {
    method: 'new_company',
    confidenceScore: 60,
    requiresManualReview: true,
    matchReason: 'No confident company match found',
    proposedCompanyName: fallbackName || 'Unknown Company',
    normalizedCompanyName: normalizeCompanyName(fallbackName || 'unknown company'),
    domain: domain || null,
    normalizedAddress: normalizedAddr || null,
  }
}
