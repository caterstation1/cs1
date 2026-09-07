'use client'

/**
 * Shared chart color system (P2).
 *
 * - `semantic`: fixed color per meaning. The New/Returning pair, revenue,
 *   and the three cost series look identical on every chart of the page.
 * - `status`: reserved for good/warning/serious signals; never used as a
 *   data-series color.
 * - `categorical`: ordered array for everything else, consumed in fixed
 *   order (never cycled per chart).
 *
 * Adjacent pairs were chosen to stay distinguishable under deuteranopia:
 * blue/teal, amber/violet/pink differ in both hue axis and lightness.
 */

import { useTheme } from 'next-themes'

export interface ChartPalette {
  semantic: {
    newCompany: string
    returningCompany: string
    revenue: string
    netProfit: string
    cogs: string
    labour: string
    delivery: string
  }
  status: {
    good: string
    warning: string
    serious: string
  }
  categorical: string[]
  /** Single-hue sequential ramp (light -> dark) for heatmaps. */
  sequential: string[]
  ink: {
    axis: string
    grid: string
  }
}

export const lightPalette: ChartPalette = {
  semantic: {
    newCompany: '#0d9488', // teal-600
    returningCompany: '#4338ca', // indigo-700
    revenue: '#2563eb', // blue-600
    netProfit: '#475569', // slate-600 (bars themselves use status good/serious)
    cogs: '#f59e0b', // amber-500
    labour: '#7c3aed', // violet-600
    delivery: '#db2777', // pink-600
  },
  status: {
    good: '#15803d', // green-700
    warning: '#b45309', // amber-700
    serious: '#b91c1c', // red-700
  },
  categorical: ['#2563eb', '#0d9488', '#f59e0b', '#7c3aed', '#db2777', '#64748b', '#0ea5e9', '#a16207'],
  sequential: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  ink: {
    axis: '#475569',
    grid: '#e2e8f0',
  },
}

export const darkPalette: ChartPalette = {
  semantic: {
    newCompany: '#2dd4bf', // teal-400
    returningCompany: '#818cf8', // indigo-400
    revenue: '#60a5fa', // blue-400
    netProfit: '#94a3b8', // slate-400
    cogs: '#fbbf24', // amber-400
    labour: '#a78bfa', // violet-400
    delivery: '#f472b6', // pink-400
  },
  status: {
    good: '#4ade80', // green-400
    warning: '#fb923c', // orange-400
    serious: '#f87171', // red-400
  },
  categorical: ['#60a5fa', '#2dd4bf', '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8', '#38bdf8', '#facc15'],
  sequential: ['#172554', '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  ink: {
    axis: '#94a3b8',
    grid: '#334155',
  },
}

/**
 * Resolve the palette for the active theme. Falls back to light when no
 * theme provider is mounted or during SSR.
 */
export function useChartColors(): ChartPalette {
  // useTheme is safe without a provider; it returns undefined values there.
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark' ? darkPalette : lightPalette
}
