/**
 * The cart page lets a customer upload a thank-you note. The upload route
 * (src/app/api/thankyou/upload/route.ts) pushes the file into Shopify Files and
 * hands back a CDN URL, which the theme stores as the cart attribute
 * "Thank you note file". Shopify carries cart attributes onto the order as note
 * attributes, and the order sync stores those on Order.noteAttributes.
 *
 * This is the customer's uploaded file, not the free-text order note or the
 * internal/customer notes staff add in the app.
 */

const ATTRIBUTE_NAME = 'thank you note file'

/** Filenames are minted as `thankyou-<YYYYMMDD>-<HHmm>-<cartToken>-<original>`. */
const UPLOAD_PREFIX = /^thankyou-\d{8}-\d{4}-[^-]+-/

export interface ThankYouNote {
  url: string
  /** The customer's original filename, with the upload route's prefix stripped off. */
  filename: string
  isImage: boolean
}

function parseNoteAttributes(raw: unknown): Array<{ name?: unknown; value?: unknown }> {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function getThankYouNote(order: unknown): ThankYouNote | null {
  const source = order as { noteAttributes?: unknown; note_attributes?: unknown } | null | undefined
  const attributes = parseNoteAttributes(source?.noteAttributes ?? source?.note_attributes)

  const match = attributes.find(
    (attr) => String(attr?.name ?? '').trim().toLowerCase() === ATTRIBUTE_NAME
  )
  const url = String(match?.value ?? '').trim()
  if (!/^https:\/\//i.test(url)) return null

  // Shopify appends a ?v= cache buster to the CDN URL.
  const path = url.split('?')[0]
  let stored = path.slice(path.lastIndexOf('/') + 1)
  try {
    stored = decodeURIComponent(stored)
  } catch {
    // Leave the raw segment if it isn't valid percent-encoding.
  }

  return {
    url,
    filename: stored.replace(UPLOAD_PREFIX, '') || stored,
    isImage: /\.(png|jpe?g|gif|webp)$/i.test(path),
  }
}
