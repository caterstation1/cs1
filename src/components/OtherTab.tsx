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
// duplicate Select import removed

export interface OtherProduct {
  id: string
  name: string
  supplier: string
  description: string
  isPreferred?: boolean
  preferredReference?: string | null
  preferredAllergens?: string[]
  listOnLabel?: boolean
  isVegetarian?: boolean
  isVegan?: boolean
  isHalal?: boolean
  cost: number
  prepCategory?: string
  createdAt: string
  updatedAt: string
}

interface OtherTabProps {
  products: OtherProduct[]
  setProducts: Dispatch<SetStateAction<OtherProduct[]>>
  isLoading: boolean
  error?: string | null
  onTogglePreferred?: (id: string, nextPreferred: boolean) => void | Promise<void>
  onUpdateDietary?: (
    id: string,
    patch: Partial<Pick<OtherProduct, 'isVegetarian' | 'isVegan' | 'isHalal'>>
  ) => void | Promise<void>
  onUpdateAllergens?: (id: string, preferredAllergens: string[]) => void | Promise<void>
  onUpdateListOnLabel?: (id: string, listOnLabel: boolean) => void | Promise<void>
}

const ALLERGEN_OPTIONS = [
  'gluten',
  'sesame',
  'soy',
  'garlic',
  'onion',
  'dairy',
  'milk',
  'egg',
  'fish',
  'nuts',
  'sulphites',
] as const

const ALLERGEN_LABELS: Record<(typeof ALLERGEN_OPTIONS)[number], string> = {
  gluten: 'Gluten',
  sesame: 'Sesame',
  soy: 'Soy',
  garlic: 'Garlic',
  onion: 'Onion',
  dairy: 'Dairy',
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  nuts: 'Nuts',
  sulphites: 'Sulphites',
}

function normalizeAllergens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
        .filter((item): item is (typeof ALLERGEN_OPTIONS)[number] =>
          ALLERGEN_OPTIONS.includes(item as (typeof ALLERGEN_OPTIONS)[number])
        )
    )
  )
}

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  supplier: z.string().min(1, "Supplier is required"),
  description: z.string().min(1, "Description is required"),
  cost: z.coerce.number().min(0, "Cost must be a positive number"),
  prepCategory: z.string().optional(),
  preferredAllergens: z.array(z.string()).optional(),
  listOnLabel: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isHalal: z.boolean().optional(),
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

export function OtherTab({
  products,
  setProducts,
  isLoading,
  error: propError,
  onTogglePreferred,
  onUpdateDietary,
  onUpdateAllergens,
  onUpdateListOnLabel,
}: OtherTabProps) {
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
      prepCategory: "",
      preferredAllergens: [],
      listOnLabel: false,
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
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
        prepCategory: editingProduct.prepCategory || '',
        preferredAllergens: normalizeAllergens(editingProduct.preferredAllergens),
        listOnLabel: Boolean(editingProduct.listOnLabel),
        isVegetarian: Boolean(editingProduct.isVegetarian),
        isVegan: Boolean(editingProduct.isVegan),
        isHalal: Boolean(editingProduct.isHalal),
      })
    } else if (!isDialogOpen) {
      form.reset({
        name: "",
        supplier: "",
        description: "",
        cost: 0,
        prepCategory: "",
        preferredAllergens: [],
        listOnLabel: false,
        isVegetarian: false,
        isVegan: false,
        isHalal: false,
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

      const saved = await response.json()
      
      // Update the products list
      if (editingProduct) {
        // Update existing product
        setProducts(prevProducts => prevProducts.map(p => p.id === editingProduct.id ? saved : p))
      } else {
        // Add new product
        setProducts(prevProducts => [...prevProducts, saved])
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
                {/* Prep Category selector with add button */}
                <FormField
                  control={form.control}
                  name="prepCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prep category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Bakery','Butchery','Hot kitchen','Cold kitchen','Desserts','Pre day prep'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="listOnLabel"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={Boolean(field.value)}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">List on label</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Contains allergens</FormLabel>
                  <FormField
                    control={form.control}
                    name="preferredAllergens"
                    render={({ field }) => {
                      const selected = normalizeAllergens(field.value)
                      return (
                        <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                          {ALLERGEN_OPTIONS.map((allergen) => {
                            const checked = selected.includes(allergen)
                            return (
                              <label key={allergen} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...selected, allergen]
                                      : selected.filter((value) => value !== allergen)
                                    field.onChange(normalizeAllergens(next))
                                  }}
                                />
                                <span>{ALLERGEN_LABELS[allergen]}</span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Dietary</FormLabel>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <FormField
                      control={form.control}
                      name="isVegetarian"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">Vegetarian</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isVegan"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">Vegan</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isHalal"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">Halal</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
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
              <TableHead>Preferred</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>List on label</TableHead>
              <TableHead>Contains</TableHead>
              <TableHead>Vegetarian</TableHead>
              <TableHead>Vegan</TableHead>
              <TableHead>Halal</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : (!products || products.length === 0) ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">
                  No products found. Add a product to get started.
                </TableCell>
              </TableRow>
            ) : (
              (products || []).filter(product => product && product.id && product.name).map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.isPreferred)}
                      onChange={(e) => {
                        const nextPreferred = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, isPreferred: nextPreferred } : item
                          )
                        )
                        void onTogglePreferred?.(product.id, nextPreferred)
                      }}
                    />
                  </TableCell>
                  <TableCell>{product.supplier || ''}</TableCell>
                  <TableCell>{product.description || ''}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.listOnLabel)}
                      onChange={(e) => {
                        const listOnLabel = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, listOnLabel } : item
                          )
                        )
                        void onUpdateListOnLabel?.(product.id, listOnLabel)
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-[280px]">
                    <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                      {ALLERGEN_OPTIONS.map((allergen) => {
                        const selected = normalizeAllergens(product.preferredAllergens)
                        const checked = selected.includes(allergen)
                        return (
                          <label key={`${product.id}:${allergen}`} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, allergen]
                                  : selected.filter((value) => value !== allergen)
                                const normalized = normalizeAllergens(next)
                                setProducts((prev) =>
                                  prev.map((item) =>
                                    item.id === product.id
                                      ? { ...item, preferredAllergens: normalized }
                                      : item
                                  )
                                )
                                void onUpdateAllergens?.(product.id, normalized)
                              }}
                            />
                            <span>{ALLERGEN_LABELS[allergen]}</span>
                          </label>
                        )
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.isVegetarian)}
                      onChange={(e) => {
                        const isVegetarian = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, isVegetarian } : item
                          )
                        )
                        void onUpdateDietary?.(product.id, { isVegetarian })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.isVegan)}
                      onChange={(e) => {
                        const isVegan = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, isVegan } : item
                          )
                        )
                        void onUpdateDietary?.(product.id, { isVegan })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={Boolean(product.isHalal)}
                      onChange={(e) => {
                        const isHalal = e.target.checked
                        setProducts((prev) =>
                          prev.map((item) =>
                            item.id === product.id ? { ...item, isHalal } : item
                          )
                        )
                        void onUpdateDietary?.(product.id, { isHalal })
                      }}
                    />
                  </TableCell>
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