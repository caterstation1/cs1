import type { CSSProperties } from 'react'

/** Shared B&W label design tokens — optimised for Brother QL-820NWB 100×62mm thermal print */

export const LABEL_LANDSCAPE = { w: 1181, h: 732 }
export const LABEL_PORTRAIT = { w: 732, h: 1181 }

export const FONT_HERO =
  "Impact, 'Arial Narrow Bold', 'Franklin Gothic Medium Condensed', 'Helvetica Neue Condensed Bold', 'Arial Black', sans-serif"
export const FONT_BODY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"

export const INK = '#000000'
export const INK_MUTED = '#3a3a3a'
export const INK_LIGHT = '#5c5c5c'
export const PAPER = '#ffffff'

export function labelDimensions(landscape: boolean) {
  return landscape ? LABEL_LANDSCAPE : LABEL_PORTRAIT
}

/** Extract a single delivery time (e.g. "12:30") from window strings like "11:30 AM - 11:45 AM" */
export function formatDeliveryTime(deliveryWindow: string): string {
  if (!deliveryWindow?.trim()) return ''
  const match = deliveryWindow.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i)
  if (!match) return deliveryWindow.trim()
  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const meridiem = (match[3] || '').toUpperCase()
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0
  return `${hour}:${minute}`
}

export function shellStyle(w: number, h: number): CSSProperties {
  return {
    width: w,
    height: h,
    background: PAPER,
    color: INK,
    padding: 32,
    boxSizing: 'border-box',
    borderRadius: 16,
    border: `1.5px solid ${INK}`,
    fontFamily: FONT_BODY,
    position: 'relative',
    overflow: 'hidden',
  }
}
