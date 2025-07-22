export interface Order {
  id: string
  orderNumber: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  shippingAddress: {
    address1: string
    address2?: string
    city: string
    province: string
    zip: string
  }
  shippingLines?: Array<{
    id: string
    phone?: string
    title: string
    price: string
  }>
  note: string
  tags: string
  fulfillmentStatus: string
  lineItems: Array<{
    title: string
    quantity: number
    sku: string
    price: number
  }>
  currency: string
  createdAt: string
  leaveTime?: string
  travelTime?: string
  driverId?: string
  deliveryTime?: string
  deliveryDate?: string
  hasLocalEdits?: boolean
  isDispatched?: boolean
} 