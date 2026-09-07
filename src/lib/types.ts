export interface GilmoursProduct {
  id?: string
  sku: string
  brand: string
  description: string
  isPreferred?: boolean
  preferredReference?: string | null
  preferredAllergens?: string[]
  packSize: string
  uom: string
  price: number
  quantity: number
}

export type GilmoursProductMap = Map<string, GilmoursProduct> 