import { z } from 'zod'

export const askRequestSchema = z.object({
  question: z.string().min(3),
  context: z.any().optional(),
  includePII: z.boolean().optional().default(true),
})

export type AskRequest = z.infer<typeof askRequestSchema>

export const confirmRequestSchema = z.object({
  confirmToken: z.string().uuid(),
})

export type ConfirmRequest = z.infer<typeof confirmRequestSchema>

export const ALLERGEN_VALUES = [
  'gluten', 'dairy', 'soy', 'onionGarlic', 'sesame', 'nuts', 'egg',
] as const

export type AllergenKey = (typeof ALLERGEN_VALUES)[number]

export type AskCandidate = {
  id: string
  kind: 'staff' | 'customer' | 'contact'
  name: string
  subtitle?: string
  phone?: string | null
  email?: string | null
  href?: string
}

export type AskChangeLine = {
  field: string
  label: string
  before: string | null
  after: string | null
}

export type AskProposal = {
  confirmToken: string
  title: string
  summary: string
  orderNumber: number
  orderContext: Record<string, string | null>
  changes: AskChangeLine[]
  unchangedNote: string
}

export interface AskAction {
  type: 'open_url' | 'confirm'
  label: string
  href?: string
  confirmToken?: string
}

export interface ToolResult {
  answer: string
  confidence: number
  candidates?: AskCandidate[]
  proposal?: AskProposal
  evidence?: {
    tables?: Array<{ name: string; rows: any[] }>
    totals?: Record<string, number | string>
    sql?: string
    links?: Array<{ label: string; href: string }>
  }
  actions?: AskAction[]
  clarificationNeeded?: string
}

/** @deprecated legacy tool params — kept for allergen helper */
export const allergenParams = z.object({
  menuName: z.string(),
  allergen: z.enum(ALLERGEN_VALUES),
})
