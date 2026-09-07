import { normalizeAddress, extractEmailRootDomain } from '@/lib/company-matching'
import { getGenericDomainsSet } from '@/lib/company-normalization-admin'

export interface DeliveryNoteScope {
  normalizedAddressKey: string
  /** Business root domain shared across contacts; null for generic-email customers */
  scopeDomain: string | null
  /** Exact customer email; used as the scope when the domain is generic */
  scopeEmail: string | null
  /** Human-readable address snapshot for display in the notes modal */
  addressLabel: string
}

function parseAddress(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return { address1: value }
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Build the normalized key for a delivery address. Deliberately excludes the
 * company field (unlike company-matching's full normalizeAddress input) so that
 * different clients at the same physical address produce the same key —
 * cross-client sharing is then controlled by the domain scope.
 */
export function buildNormalizedAddressKey(shippingAddress: unknown): string {
  const addr = parseAddress(shippingAddress)
  const line2 = [str(addr.address2), str(addr.address3)].filter(Boolean).join(' ')
  return normalizeAddress({
    address1: str(addr.address1),
    address2: line2,
    city: str(addr.city),
    zip: str(addr.zip) || str(addr.postcode),
  })
}

export function buildAddressLabel(shippingAddress: unknown): string {
  const addr = parseAddress(shippingAddress)
  return [str(addr.address1), str(addr.address2), str(addr.address3), str(addr.city)]
    .filter(Boolean)
    .join(', ')
}

/**
 * Resolve the address key + client scope for an order's delivery notes.
 * Business-domain emails share notes across all contacts at that domain;
 * generic-domain emails (gmail etc., seeded + DB GenericDomain rows) are
 * scoped to the exact email address.
 */
export function resolveDeliveryNoteScope(
  shippingAddress: unknown,
  customerEmail: string | null | undefined,
  genericDomains: Set<string>
): DeliveryNoteScope {
  const normalizedAddressKey = buildNormalizedAddressKey(shippingAddress)
  const addressLabel = buildAddressLabel(shippingAddress)
  const email = (customerEmail || '').trim().toLowerCase() || null
  const rootDomain = extractEmailRootDomain(email)
  const isGeneric = !rootDomain || genericDomains.has(rootDomain)
  return {
    normalizedAddressKey,
    scopeDomain: isGeneric ? null : rootDomain,
    scopeEmail: isGeneric ? email : null,
    addressLabel,
  }
}

export async function buildDeliveryNoteScope(
  shippingAddress: unknown,
  customerEmail: string | null | undefined
): Promise<DeliveryNoteScope> {
  const genericDomains = await getGenericDomainsSet()
  return resolveDeliveryNoteScope(shippingAddress, customerEmail, genericDomains)
}
