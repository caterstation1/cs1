// Which supplier sent this email?
//
// Forwarded mail is messy: an Apple Mail "forward" rule rewrites the sender to
// Peter, while a "redirect" keeps the original. So the sender address is a
// strong signal when it matches a supplier domain, and otherwise we score
// keyword occurrences across subject and body.

import { SupplierId } from './parse'

const DOMAIN_SIGNALS: Array<{ supplier: SupplierId; pattern: RegExp }> = [
  { supplier: 'bidfood', pattern: /bidfood/i },
  { supplier: 'gilmours', pattern: /gilmours?/i },
  { supplier: 'produceco', pattern: /produce/i },
]

const KEYWORD_SIGNALS: Array<{ supplier: SupplierId; pattern: RegExp }> = [
  { supplier: 'bidfood', pattern: /bidfood/gi },
  { supplier: 'gilmours', pattern: /gilmours?/gi },
  { supplier: 'produceco', pattern: /produce\s*(co|company)/gi },
]

export interface IdentifyInput {
  from: string
  subject: string
  text?: string | null
  html?: string | null
}

export function identifySupplier(input: IdentifyInput): SupplierId | null {
  for (const { supplier, pattern } of DOMAIN_SIGNALS) {
    if (pattern.test(input.from)) return supplier
  }

  // Cap the scanned body so a huge email cannot stall the regex pass.
  const haystack = `${input.subject}\n${(input.text ?? '').slice(0, 20000)}\n${(input.html ?? '').slice(0, 40000)}`
  const scores = new Map<SupplierId, number>()
  for (const { supplier, pattern } of KEYWORD_SIGNALS) {
    const count = (haystack.match(pattern) ?? []).length
    if (count > 0) scores.set(supplier, (scores.get(supplier) ?? 0) + count)
  }
  if (!scores.size) return null

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  // Ambiguous mentions (e.g. a newsletter comparing suppliers) → unknown.
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null
  return ranked[0][0]
}

export const SUPPLIER_LABEL: Record<SupplierId, string> = {
  gilmours: 'Gilmours',
  bidfood: 'Bidfood',
  produceco: 'Produce Company',
}
