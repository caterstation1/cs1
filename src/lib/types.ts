export interface GilmoursProduct {
  sku: string
  brand: string
  description: string
  packSize: string
  uom: string
  price: number
  quantity: number
}

export type GilmoursProductMap = Map<string, GilmoursProduct> 