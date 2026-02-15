/**
 * Canonical order scheduling fields
 * 
 * This module provides server-side canonicalization of order scheduling data:
 * - Region (AKL, WLG, OTHER)
 * - Delivery date/time (canonical DateTime)
 * - Source tracking
 * - Needs review flag
 * 
 * This ensures deterministic, queryable scheduling data stored in the database.
 */

import { isWellingtonOrder } from './region'
import { parseLocalDate } from './date-utils'

export type DeliveryDateSource = 'field' | 'noteAttributes' | 'tags' | 'createdAtFallback' | 'unknown'

export interface CanonicalizedScheduling {
  region: 'AKL' | 'WLG' | 'OTHER'
  deliveryDateTime: Date | null
  deliveryDateSource: DeliveryDateSource
  needsSchedulingReview: boolean
}

/**
 * Derives canonical region from order data
 * Uses existing priority-based region logic
 */
export function deriveRegion(order: any): 'AKL' | 'WLG' | 'OTHER' {
  if (isWellingtonOrder(order)) {
    return 'WLG'
  }
  
  // Check if explicitly Auckland
  const ship = order?.shippingAddress || order?.shipping_address || {}
  const provCode = String(ship?.province_code || '').toUpperCase()
  const province = String(ship?.province || '').toLowerCase()
  
  if (provCode === 'AUK' || province === 'auckland') {
    return 'AKL'
  }
  
  // Default to AKL if in NZ, otherwise OTHER
  const country = String(ship?.country || '').toLowerCase()
  if (country === 'new zealand' || country === 'nz' || !country) {
    return 'AKL' // Default to AKL for NZ orders
  }
  
  return 'OTHER'
}

/**
 * Extracts delivery date and time from order
 * Returns null if no confident date/time can be extracted
 */
export function extractDeliveryDateTime(order: any): { value: Date | null; source: DeliveryDateSource } {
  // Priority 1: deliveryDate field (if exists and valid)
  if (order?.deliveryDate) {
    const date = parseLocalDate(order.deliveryDate)
    if (date) {
      // Combine with deliveryTime if available
      let dateTime = date
      if (order?.deliveryTime) {
        const timeMatch = order.deliveryTime.match(/(\d{1,2}):(\d{2})/)
        if (timeMatch) {
          const [, hours, minutes] = timeMatch
          dateTime = new Date(date)
          dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
        }
      }
      return { value: dateTime, source: 'field' }
    }
  }
  
  // Priority 2: noteAttributes delivery date/time
  const noteAttrs = order?.noteAttributes || order?.note_attributes
  if (noteAttrs) {
    let dateAttr: any = null
    let timeAttr: any = null
    
    if (Array.isArray(noteAttrs)) {
      dateAttr = noteAttrs.find((a: any) => 
        typeof a?.name === 'string' && 
        a.name.toLowerCase().includes('delivery date')
      )
      timeAttr = noteAttrs.find((a: any) => 
        typeof a?.name === 'string' && 
        (a.name.toLowerCase().includes('delivery time') || a.name.toLowerCase().includes('time'))
      )
    } else if (typeof noteAttrs === 'object') {
      const keys = Object.keys(noteAttrs)
      const dateKey = keys.find(k => k.toLowerCase().includes('delivery date'))
      const timeKey = keys.find(k => k.toLowerCase().includes('delivery time') || k.toLowerCase().includes('time'))
      if (dateKey) dateAttr = { value: noteAttrs[dateKey] }
      if (timeKey) timeAttr = { value: noteAttrs[timeKey] }
    }
    
    if (dateAttr?.value) {
      const date = parseLocalDate(dateAttr.value)
      if (date) {
        let dateTime = date
        if (timeAttr?.value) {
          const timeMatch = String(timeAttr.value).match(/(\d{1,2}):(\d{2})/)
          if (timeMatch) {
            const [, hours, minutes] = timeMatch
            dateTime = new Date(date)
            dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
          }
        }
        return { value: dateTime, source: 'noteAttributes' }
      }
    }
  }
  
  // Priority 3: Tags parsing (e.g. "11:45 AM - 12:00 PM, Tue Feb 24 2026")
  if (typeof order?.tags === 'string' && order.tags.trim().length > 0) {
    // Try to extract date from tags
    // Look for patterns like "Tue Feb 24 2026" or "Feb 24, 2026"
    const datePatterns = [
      /\b([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\b/, // "Tue Feb 24 2026"
      /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/, // "February 24, 2026" or "Feb 24 2026"
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-]((?:19|20)\d{2})\b/, // "24/02/2026" or "24-02-2026"
    ]
    
    for (const pattern of datePatterns) {
      const match = order.tags.match(pattern)
      if (match) {
        const dateStr = match[0]
        const date = parseLocalDate(dateStr)
        if (date) {
          // Try to extract time from tags (e.g. "11:45 AM - 12:00 PM")
          let dateTime = date
          const timeMatch = order.tags.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10)
            const minutes = parseInt(timeMatch[2], 10)
            const ampm = timeMatch[3]?.toUpperCase()
            if (ampm === 'PM' && hours !== 12) hours += 12
            if (ampm === 'AM' && hours === 12) hours = 0
            dateTime = new Date(date)
            dateTime.setHours(hours, minutes, 0, 0)
          }
          return { value: dateTime, source: 'tags' }
        }
      }
    }
  }
  
  // Priority 4: createdAt fallback (BUT mark as needs review)
  // Only use if explicitly intended - otherwise return null
  if (order?.createdAt) {
    const created = new Date(order.createdAt)
    // Use createdAt but mark for review since it's not a real delivery date
    return { value: created, source: 'createdAtFallback' }
  }
  
  // No confident date/time found
  return { value: null, source: 'unknown' }
}

/**
 * Canonicalizes order scheduling data
 * 
 * Returns deterministic scheduling fields:
 * - region: AKL, WLG, or OTHER
 * - deliveryDateTime: Canonical datetime or null
 * - deliveryDateSource: Where the date came from
 * - needsSchedulingReview: True if deliveryDateTime is missing/invalid or from createdAt fallback
 * 
 * Safety rule: If no confident delivery date/time exists, do NOT invent a date.
 * Instead: deliveryDateTime = null and needsSchedulingReview = true
 */
export function canonicalizeOrderScheduling(order: any): CanonicalizedScheduling {
  const region = deriveRegion(order)
  const { value: deliveryDateTime, source: deliveryDateSource } = extractDeliveryDateTime(order)
  
  // Mark as needs review if:
  // 1. No delivery date/time found (unknown source)
  // 2. Using createdAt fallback (not a real delivery date)
  const needsSchedulingReview = 
    deliveryDateTime === null || 
    deliveryDateSource === 'unknown' ||
    deliveryDateSource === 'createdAtFallback'
  
  return {
    region,
    deliveryDateTime,
    deliveryDateSource,
    needsSchedulingReview
  }
}
