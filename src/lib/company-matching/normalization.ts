const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.nz',
  'yahoo.com',
  'yahoo.co.nz',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'live.com',
  'xtra.co.nz',
  'xtra.com',
  'net.nz',
  'school.nz',
])

const LEGAL_SUFFIXES = new Set([
  'ltd',
  'limited',
  'inc',
  'llc',
  'co',
  'company',
  'group',
  'holdings',
  'nz',
  'new',
  'zealand',
])

const ADDRESS_TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\blevel\b/g, 'l'],
  [/\bfloor\b/g, 'l'],
  [/\bstreet\b/g, 'st'],
  [/\broad\b/g, 'rd'],
  [/\bavenue\b/g, 'ave'],
  [/\bdrive\b/g, 'dr'],
  [/\bboulevard\b/g, 'blvd'],
  [/\bplace\b/g, 'pl'],
  [/\bunit\b/g, 'u'],
  [/\bapartment\b/g, 'apt'],
]

function splitDomainLabels(domain: string): string[] {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^www\./, '')
    .split('.')
    .filter(Boolean)
}

function extractRootDomain(domain: string): string | null {
  const labels = splitDomainLabels(domain)
  if (labels.length < 2) return null

  const twoLevelSuffixes = new Set(['co.nz', 'org.nz', 'govt.nz', 'ac.nz', 'co.uk', 'com.au'])
  const suffix2 = labels.slice(-2).join('.')
  if (labels.length >= 3 && twoLevelSuffixes.has(suffix2)) {
    return labels.slice(-3).join('.')
  }
  return labels.slice(-2).join('.')
}

export function extractEmailRootDomain(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null
  const rawDomain = email.split('@').pop()?.trim().toLowerCase()
  if (!rawDomain) return null
  return extractRootDomain(rawDomain)
}

export function isGenericEmailDomain(domain?: string | null): boolean {
  if (!domain) return false
  return GENERIC_EMAIL_DOMAINS.has(domain.trim().toLowerCase())
}

export function extractBusinessDomain(email?: string | null): string | null {
  const root = extractEmailRootDomain(email)
  if (!root) return null
  if (isGenericEmailDomain(root)) return null
  return root
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ')
}

export function domainToCompanyName(domain?: string | null): string {
  if (!domain) return 'Unknown Company'
  const labels = splitDomainLabels(domain)
  const rootLabel = labels[0] || domain
  const clean = rootLabel.replace(/[^a-z0-9]+/gi, ' ').trim()
  return toTitleCase(clean || rootLabel)
}

export function normalizeCompanyName(raw?: string | null): string {
  if (!raw) return ''
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned
    .split(' ')
    .filter(Boolean)
    .filter((token) => !LEGAL_SUFFIXES.has(token))

  return tokens.join(' ').trim()
}

function toAddressParts(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'object') {
    const addr = value as Record<string, unknown>
    return [
      addr.address1,
      addr.address2,
      addr.city,
      addr.province,
      addr.region,
      addr.zip,
      addr.postcode,
      addr.country,
      addr.company,
    ]
      .filter((v) => typeof v === 'string' && String(v).trim().length > 0)
      .map((v) => String(v))
  }
  return []
}

export function normalizeAddress(value: unknown): string {
  let merged = toAddressParts(value).join(' ')
  merged = merged.toLowerCase().replace(/[^\w\s]/g, ' ')
  for (const [pattern, replacement] of ADDRESS_TOKEN_REPLACEMENTS) {
    merged = merged.replace(pattern, replacement)
  }
  merged = merged.replace(/\bl\s+(\d+)\b/g, 'l$1')
  return merged.replace(/\s+/g, ' ').trim()
}
