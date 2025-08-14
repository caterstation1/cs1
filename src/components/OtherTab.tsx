'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Dispatch, SetStateAction } from 'react'

export interface OtherProduct {
  id: string
  name: string
  supplier: string
  description: string
  cost: number
  createdAt: string
  updatedAt: string
}

interface OtherTabProps {
  products: OtherProduct[]
  setProducts: Dispatch<SetStateAction<OtherProduct[]>>
  isLoading: boolean
  error?: string | null
}

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  supplier: z.string().min(1, "Supplier is required"),
  description: z.string().min(1, "Description is required"),
  cost: z.coerce.number().min(0, "Cost must be a positive number"),
})

// Supplier interface
interface Supplier {
  id: string
  name: string
  contactName: string
  contactNumber: string
  contactEmail: string
  createdAt: string
  updatedAt: string
}

export function OtherTab({ products, setProducts, isLoading, error: propError }: OtherTabProps) {
  const [error, setError] = useState<string | null>(propError || null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<OtherProduct | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)

  // Fetch suppliers from API
  useEffect(() => {
    const fetchSuppliers = async () => {
      setIsLoadingSuppliers(true)
      try {
        const response = await fetch('/api/suppliers')
        if (!response.ok) {
          throw new Error('Failed to fetch suppliers')
        }
        const data = await response.json()
        // Ensure data is an array and filter out any invalid entries
        const validSuppliers = Array.isArray(data) ? data.filter(supplier => 
          supplier && typeof supplier === 'object' && supplier.id && supplier.name
        ) : []
        setSuppliers(validSuppliers)
        console.log('✅ Fetched suppliers:', validSuppliers)
      } catch (error) {
        console.error('❌ Error fetching suppliers:', error)
        setError('Failed to load suppliers')
      } finally {
        setIsLoadingSuppliers(false)
      }
    }

    fetchSuppliers()
  }, [])

  // Update error state when prop changes
  useEffect(() => {
    if (propError) {
      setError(propError)
    }
  }, [propError])

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      supplier: "",
      description: "",
      cost: 0,
    },
  })

  // Reset form when dialog opens/closes or editing product changes
  useEffect(() => {
    if (isDialogOpen && editingProduct) {
      form.reset({
        name: editingProduct.name,
        supplier: editingProduct.supplier,
        description: editingProduct.description,
        cost: editingProduct.cost,
      })
    } else if (!isDialogOpen) {
      form.reset({
        name: "",
        supplier: "",
        description: "",
        cost: 0,
      })
      setEditingProduct(null)
    }
  }, [isDialogOpen, editingProduct, form])

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const productToSave = {
        ...values,
        id: editingProduct?.id || "",
      }

      const response = await fetch('/api/other', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productToSave),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save product')
      }

      const savedProducts = await response.json()
      
      // Update the products list
      if (editingProduct) {
        // Update existing product
        setProducts(prevProducts => 
          prevProducts.map(p => 
            p.id === editingProduct.id ? savedProducts[0] : p
          )
        )
      } else {
        // Add new product
        setProducts(prevProducts => [...prevProducts, savedProducts[0]])
      }

      // Close dialog
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving product:', error)
      setError(error instanceof Error ? error.message : 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete product
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    setError(null)

    try {
      // Filter out the product to delete
      const updatedProducts = products.filter(p => p.id !== id)
      
      // Update the state immediately for better UX
      setProducts(updatedProducts)
      
      // Note: We don't have a DELETE endpoint yet, so we'll just update the local state
      // In a real implementation, you'd want to add a DELETE endpoint to the API
      console.log('Product deleted from local state:', id)
    } catch (error) {
      console.error('Error deleting product:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete product')
      
      // Refresh products from server to ensure consistency
      const response = await fetch('/api/other')
      if (response.ok) {
        const fetchedProducts = await response.json()
        setProducts(fetchedProducts)
      }
    }
  }

  // Open dialog for editing
  const handleEdit = (product: OtherProduct) => {
    setEditingProduct(product)
    setIsDialogOpen(true)
  }

  // Open dialog for adding new product
  const handleAdd = () => {
    setEditingProduct(null)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Other Products</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              <DialogDescription>
                {editingProduct 
                  ? 'Edit the product details below.' 
                  : 'Fill in the details to add a new product.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSuppliers ? (
                            <SelectItem value="" disabled>
                              Loading suppliers...
                            </SelectItem>
                          ) : suppliers.length === 0 ? (
                            <SelectItem value="" disabled>
                              No suppliers available
                            </SelectItem>
                          ) : (
                            suppliers.filter(supplier => supplier && supplier.name && supplier.id).map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.name}>
                                {supplier.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Product description" 
                          className="resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : (!products || products.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No products found. Add a product to get started.
                </TableCell>
              </TableRow>
            ) : (
              (products || []).filter(product => product && product.id && product.name).map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.supplier || ''}</TableCell>
                  <TableCell>{product.description || ''}</TableCell>
                  <TableCell className="text-right">${(product.cost || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 