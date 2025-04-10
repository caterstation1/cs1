import { z } from 'zod'

export const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().min(0, 'Quantity must be positive'),
  cost: z.number().min(0, 'Cost must be positive'),
  source: z.enum(['Gilmours', 'Bidfood', 'Other', 'Components', 'Products']),
})

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  ingredients: z.array(ingredientSchema),
})

export type Ingredient = z.infer<typeof ingredientSchema>
export type ProductFormData = z.infer<typeof productSchema>

export interface Product extends ProductFormData {
  id: string
  totalCost: number
  realizedMargin?: number
  createdAt: Date
  updatedAt: Date
} 