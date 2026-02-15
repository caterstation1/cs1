import { z } from 'zod'

export const askRequestSchema = z.object({
  question: z.string().min(3),
  context: z.any().optional(),
  includePII: z.boolean().optional().default(false),
})

export type AskRequest = z.infer<typeof askRequestSchema>

export const spendByItemParams = z.object({
  itemName: z.string(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  suppliers: z.array(z.string()).optional(),
})
export type SpendByItemParams = z.infer<typeof spendByItemParams>

export const forecastParams = z.object({
  product: z.string(),
  growthPct: z.number().optional().default(10),
  lookbackDays: z.number().optional().default(84),
})
export type ForecastParams = z.infer<typeof forecastParams>

export const countForDateParams = z.object({
  product: z.string(),
  // ISO date string (YYYY-MM-DD) preferred; we keep it generic and parse server-side
  date: z.string(),
})
export type CountForDateParams = z.infer<typeof countForDateParams>

export const allergenParams = z.object({
  menuName: z.string(),
  allergen: z.enum([
    'gluten','dairy','soy','onionGarlic','sesame','nuts','egg',
  ]),
})
export type AllergenParams = z.infer<typeof allergenParams>

export const deliveryDetailsParams = z.object({
  orderNumber: z.union([z.string(), z.number()]),
})
export type DeliveryDetailsParams = z.infer<typeof deliveryDetailsParams>

export interface ToolResult {
  answer: string
  confidence: number
  evidence?: {
    tables?: Array<{ name: string; rows: any[] }>
    totals?: Record<string, number | string>
    sql?: string
    links?: Array<{ label: string; href: string }>
  }
  clarificationNeeded?: string
}



