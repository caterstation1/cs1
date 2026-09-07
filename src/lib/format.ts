/**
 * Shared value formatter for the executive dashboard (P1).
 * Every tile, table cell, axis tick, and tooltip formats numbers through this.
 */

export type ValueFormat =
  | 'currency'
  | 'currencyCompact'
  | 'percent'
  | 'count'
  | 'days'
  | 'hours'
  | 'text'

const LOCALE = 'en-NZ'
const CURRENCY = 'NZD'

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatValue(value: unknown, format: ValueFormat = 'count'): string {
  if (format === 'text') return value == null ? '-' : String(value)
  const n = toFiniteNumber(value)
  if (n == null) return '-'

  switch (format) {
    case 'currency':
      return n.toLocaleString(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    case 'currencyCompact': {
      const abs = Math.abs(n)
      const sign = n < 0 ? '-' : ''
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 2 })}M`
      if (abs >= 10_000) return `${sign}$${(abs / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}K`
      if (abs >= 1_000) return `${sign}$${(abs / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 2 })}K`
      return `${sign}$${abs.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`
    }
    case 'percent':
      return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    case 'count':
      return n.toLocaleString(LOCALE, { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })
    case 'days': {
      const rounded = n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })
      return `${rounded} ${Math.abs(n - 1) < 1e-9 ? 'day' : 'days'}`
    }
    case 'hours': {
      const rounded = n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })
      return `${rounded} ${Math.abs(n - 1) < 1e-9 ? 'hr' : 'hrs'}`
    }
    default:
      return String(n)
  }
}

/** Compact axis-tick formatter: short currency/counts so ticks stay readable. */
export function formatAxisTick(value: unknown, format: ValueFormat = 'count'): string {
  const n = toFiniteNumber(value)
  if (n == null) return ''
  if (format === 'currency' || format === 'currencyCompact') return formatValue(n, 'currencyCompact')
  if (format === 'percent') return `${n.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}%`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}K`
  return n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })
}

/** Signed delta like "+4.2%" / "-1.8%". */
export function formatDeltaPct(deltaPct: number): string {
  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
