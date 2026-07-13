export interface Order {
  id: string
  orderNumber: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail?: string
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
  /** Shopify financial status (e.g. "pending" = Awaiting payment, "paid") */
  financialStatus?: string
  /** Server-computed: true when this is the customer's first order (by email) */
  isFirstOrder?: boolean
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
  /** Optional assigned delivery vehicle (references Car.id) */
  carId?: string
  deliveryTime?: string
  deliveryDate?: string
  hasLocalEdits?: boolean
  isDispatched?: boolean
  internalNote?: string
  // New server-computed delivery day (Auckland-local day stored as DATE in DB)
  deliveryDateResolved?: string
} 