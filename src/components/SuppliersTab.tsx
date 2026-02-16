"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

// Define the Supplier type
interface Supplier {
  id: string
  name: string
  contactName: string | null
  contactNumber: string | null
  contactEmail: string | null
  emailSettings?: {
    bakery?: {
      enabled: boolean
      autoSend: boolean
    }
  } | null
  createdAt: string
  updatedAt: string
}

// Define the form schema
const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  contactEmail: z.string().email("Invalid email").optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [sendingEmails, setSendingEmails] = useState<Record<string, boolean>>({})

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "",
      name: "",
      contactName: null,
      contactNumber: null,
      contactEmail: null,
    },
  })

  // Fetch suppliers on component mount
  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Fetch suppliers from API
  const fetchSuppliers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/suppliers")
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }
      
      const data = await response.json()
      setSuppliers(data)
    } catch (err) {
      console.error("Error fetching suppliers:", err)
      setError("Failed to load suppliers. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error: ${response.status}`)
      }
      
      // Refresh suppliers list
      await fetchSuppliers()
      
      // Close dialog and reset form
      setIsDialogOpen(false)
      form.reset()
      setEditingSupplier(null)
    } catch (err) {
      console.error("Error saving supplier:", err)
      setError(err instanceof Error ? err.message : "Failed to save supplier")
    } finally {
      setIsLoading(false)
    }
  }

  // Open dialog for editing a supplier
  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    form.reset({
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName,
      contactNumber: supplier.contactNumber,
      contactEmail: supplier.contactEmail,
    })
    setIsDialogOpen(true)
  }

  // Open dialog for adding a new supplier
  const handleAdd = () => {
    setEditingSupplier(null)
    form.reset({
      id: "",
      name: "",
      contactName: null,
      contactNumber: null,
      contactEmail: null,
    })
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Suppliers</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>Add New Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier
                  ? "Update the supplier information below."
                  : "Fill in the supplier information below."}
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
                        <Input placeholder="Supplier name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Contact person"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Phone number"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Email address"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading && suppliers.length === 0 ? (
        <div className="text-center py-8">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-8">
          No suppliers found. Add your first supplier to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Name</TableHead>
                <TableHead>Contact Number</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Email Settings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => {
                const emailSettings = supplier.emailSettings || {}
                const bakeryEnabled = emailSettings.bakery?.enabled || false
                const isSending = sendingEmails[supplier.id] || false
                
                return (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contactName || "-"}</TableCell>
                    <TableCell>{supplier.contactNumber || "-"}</TableCell>
                    <TableCell>{supplier.contactEmail || "-"}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={bakeryEnabled}
                            onChange={async (e) => {
                              try {
                                const newSettings = {
                                  ...emailSettings,
                                  bakery: {
                                    enabled: e.target.checked,
                                    autoSend: e.target.checked ? (emailSettings.bakery?.autoSend ?? true) : false
                                  }
                                }
                                const response = await fetch(`/api/suppliers/${supplier.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ emailSettings: newSettings })
                                })
                                if (response.ok) {
                                  await fetchSuppliers()
                                } else {
                                  alert('Failed to update email settings')
                                }
                              } catch (error) {
                                console.error('Error updating email settings:', error)
                                alert('Error updating email settings')
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <span>Bakery Enabled</span>
                        </label>
                        {bakeryEnabled && (
                          <label className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                            <input
                              type="checkbox"
                              checked={emailSettings.bakery?.autoSend || false}
                              onChange={async (e) => {
                                try {
                                  const newSettings = {
                                    ...emailSettings,
                                    bakery: {
                                      enabled: true,
                                      autoSend: e.target.checked
                                    }
                                  }
                                  const response = await fetch(`/api/suppliers/${supplier.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ emailSettings: newSettings })
                                  })
                                  if (response.ok) {
                                    await fetchSuppliers()
                                  } else {
                                    alert('Failed to update email settings')
                                  }
                                } catch (error) {
                                  console.error('Error updating email settings:', error)
                                  alert('Error updating email settings')
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span>Auto-send (9 AM & 3:15 PM)</span>
                          </label>
                        )}
                        {bakeryEnabled && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSending || !supplier.contactEmail}
                            onClick={async () => {
                              setSendingEmails(prev => ({ ...prev, [supplier.id]: true }))
                              try {
                                const response = await fetch(`/api/suppliers/${supplier.id}/send-bakery-email`, {
                                  method: 'POST'
                                })
                                if (response.ok) {
                                  alert('Bakery order email sent successfully')
                                } else {
                                  const error = await response.json()
                                  alert(`Failed to send email: ${error.error || 'Unknown error'}`)
                                }
                              } catch (error) {
                                console.error('Error sending email:', error)
                                alert('Error sending email')
                              } finally {
                                setSendingEmails(prev => ({ ...prev, [supplier.id]: false }))
                              }
                            }}
                          >
                            {isSending ? 'Sending...' : 'Send Email'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
} 