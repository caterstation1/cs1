export interface Staff {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  payRate: number
  accessLevel: string
  isDriver: boolean
  createdAt: string
  updatedAt: string
  lastLogin?: string
  password?: string
  resetToken?: string
  resetTokenExpiry?: string
} 