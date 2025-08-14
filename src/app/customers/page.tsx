'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Package, 
  Star,
  Edit,
  Plus,
  TrendingUp,
  Clock,
  MapPin
} from 'lucide-react'

interface Customer {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  totalOrders: number
  totalSpent: number
  last60DaysSpent: number
  firstOrderDate: string
  lastOrderDate: string
  internalNotes?: string
  averageOrderValue: number
  orderFrequency: number // days between orders
  isVIP: boolean
  tags: string[]
}

interface Order {
  id: string
  orderNumber: string
  createdAt: string
  deliveryDate: string
  total: number
  status: string
  items: any[]
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [activeTab, setActiveTab] = useState('most-orders')

  // Fetch customers data
  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch customer orders
  const fetchCustomerOrders = useCallback(async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/orders`)
      if (response.ok) {
        const data = await response.json()
        setCustomerOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error)
    }
  }, [])

  // Save internal notes
  const saveNotes = useCallback(async () => {
    if (!selectedCustomer) return

    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesText })
      })

      if (response.ok) {
        // Update local state
        setCustomers(prev => prev.map(customer => 
          customer.id === selectedCustomer.id 
            ? { ...customer, internalNotes: notesText }
            : customer
        ))
        setIsNotesDialogOpen(false)
      }
    } catch (error) {
      console.error('Error saving notes:', error)
    }
  }, [selectedCustomer, notesText])

  // Handle customer selection
  const handleCustomerClick = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    setNotesText(customer.internalNotes || '')
    fetchCustomerOrders(customer.id)
  }, [fetchCustomerOrders])

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer => 
    customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  )

  // Sort customers based on active tab
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    switch (activeTab) {
      case 'most-orders':
        return b.totalOrders - a.totalOrders
      case 'most-spent':
        return b.totalSpent - a.totalSpent
      case 'recent-spent':
        return b.last60DaysSpent - a.last60DaysSpent
      case 'vip':
        return (b.isVIP ? 1 : 0) - (a.isVIP ? 1 : 0)
      default:
        return 0
    }
  })

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading customers...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-gray-600">Manage customer relationships and track order history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search Customers</Label>
          <Input
            id="search"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Customer Lists */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="most-orders">Most Orders</TabsTrigger>
          <TabsTrigger value="most-spent">Most Spent</TabsTrigger>
          <TabsTrigger value="recent-spent">Last 60 Days</TabsTrigger>
          <TabsTrigger value="vip">VIP Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="most-orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Customers by Order Count
              </CardTitle>
              <CardDescription>Customers with the most orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.slice(0, 10).map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleCustomerClick(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{customer.totalOrders}</Badge>
                      </TableCell>
                      <TableCell>${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{new Date(customer.lastOrderDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="most-spent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Customers by Total Spend
              </CardTitle>
              <CardDescription>Customers with the highest total spend</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Avg Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.slice(0, 10).map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleCustomerClick(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{customer.totalOrders}</TableCell>
                      <TableCell>${(customer.averageOrderValue || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-spent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity (Last 60 Days)
              </CardTitle>
              <CardDescription>Customers with highest spend in the last 60 days</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Last 60 Days</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.slice(0, 10).map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleCustomerClick(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">${(customer.last60DaysSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{customer.totalOrders}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vip" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                VIP Customers
              </CardTitle>
              <CardDescription>High-value customers requiring special attention</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>VIP Status</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.filter(c => c.isVIP).slice(0, 10).map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleCustomerClick(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <Star className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-yellow-500">VIP</Badge>
                      </TableCell>
                      <TableCell className="font-bold">${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{customer.totalOrders}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{selectedCustomer.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>Customer since {new Date(selectedCustomer.firstOrderDate).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{selectedCustomer.totalOrders}</div>
                      <div className="text-sm text-gray-500">Total Orders</div>
                    </div>
                    <div className="text-center">
                                           <div className="text-2xl font-bold">${(selectedCustomer.totalSpent || 0).toFixed(2)}</div>
                     <div className="text-sm text-gray-500">Total Spent</div>
                   </div>
                   <div className="text-center">
                     <div className="text-2xl font-bold">${(selectedCustomer.averageOrderValue || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Avg Order</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{selectedCustomer.orderFrequency}</div>
                      <div className="text-sm text-gray-500">Days Between Orders</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Internal Notes */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Internal Notes
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsNotesDialogOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Notes
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg min-h-[100px]">
                    {selectedCustomer.internalNotes ? (
                      <p className="whitespace-pre-wrap">{selectedCustomer.internalNotes}</p>
                    ) : (
                      <p className="text-gray-500 italic">No internal notes yet. Click &quot;Edit Notes&quot; to add some.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Order History */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Order History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Delivery</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(order.deliveryDate).toLocaleDateString()}</TableCell>
                          <TableCell>${(order.total || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Notes Edit Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Internal Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add internal notes about this customer..."
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveNotes}>
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
