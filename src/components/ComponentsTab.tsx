'use client'

import * as React from "react"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Dispatch, SetStateAction } from 'react'
import { IngredientSelector } from './IngredientSelector'
import { Resolver } from "react-hook-form"

export interface Component {
  id: string
  name: string
  description: string
  ingredients: {
    source: string
    id: string
    name: string
    quantity: number
    cost: number
    unit: string
  }[]
  totalCost: number
  hasGluten: boolean
  hasDairy: boolean
  hasSoy: boolean
  hasOnionGarlic: boolean
  hasSesame: boolean
  hasNuts: boolean
  hasEgg: boolean
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
  isComponentListItem: boolean
  createdAt: string
  updatedAt: string
}

interface ComponentsTabProps {
  components: Component[]
  setComponents: Dispatch<SetStateAction<Component[]>>
  isLoading: boolean
  error?: string | null
}

// Define the source type for ingredients
type IngredientSource = "Bidfood" | "Gilmours" | "Other" | "Components" | "Products";

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  ingredients: z.array(z.object({
    source: z.enum(["Bidfood", "Gilmours", "Other", "Components", "Products"]) as z.ZodType<IngredientSource>,
    id: z.string(),
    name: z.string(),
    quantity: z.number().min(0),
    cost: z.number().min(0),
    unit: z.string()
  })),
  hasGluten: z.boolean(),
  hasDairy: z.boolean(),
  hasSoy: z.boolean(),
  hasOnionGarlic: z.boolean(),
  hasSesame: z.boolean(),
  hasNuts: z.boolean(),
  hasEgg: z.boolean(),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
  isHalal: z.boolean(),
  isComponentListItem: z.boolean(),
  totalCost: z.number().min(0)
});

// Define the form values type
type FormValues = {
  name: string;
  description?: string;
  ingredients: {
    source: IngredientSource;
    id: string;
    name: string;
    quantity: number;
    cost: number;
    unit: string;
  }[];
  hasGluten: boolean;
  hasDairy: boolean;
  hasSoy: boolean;
  hasOnionGarlic: boolean;
  hasSesame: boolean;
  hasNuts: boolean;
  hasEgg: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isHalal: boolean;
  isComponentListItem: boolean;
  totalCost: number;
}

export function ComponentsTab({ components, setComponents, isLoading, error: propError }: ComponentsTabProps) {
  const [error, setError] = useState<string | null>(propError || null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<Component | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update error state when prop changes
  useEffect(() => {
    if (propError) {
      setError(propError)
    }
  }, [propError])

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      description: "",
      ingredients: [],
      hasGluten: false,
      hasDairy: false,
      hasSoy: false,
      hasOnionGarlic: false,
      hasSesame: false,
      hasNuts: false,
      hasEgg: false,
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
      isComponentListItem: true,
      totalCost: 0
    }
  })

  // Watch ingredients for changes to update total cost and allergen flags
  const ingredients = form.watch('ingredients')
  useEffect(() => {
    // Calculate total cost
    const totalCost = ingredients.reduce((sum, ingredient) => 
      sum + (ingredient.quantity * ingredient.cost), 0
    )
    form.setValue('totalCost', totalCost)

    // Update allergen flags based on Bidfood ingredients
    const bidfoodIngredients = ingredients.filter(i => i.source === 'Bidfood')
    const allergenFlags = {
      hasGluten: false,
      hasDairy: false,
      hasSoy: false,
      hasOnionGarlic: false,
      hasSesame: false,
      hasNuts: false,
      hasEgg: false,
    }

    // Fetch allergen information for Bidfood ingredients
    const updateAllergenFlags = async () => {
      try {
        const response = await fetch('/api/bidfood')
        if (!response.ok) throw new Error('Failed to fetch Bidfood products')
        
        const bidfoodProducts = await response.json()
        const selectedProducts = bidfoodProducts.filter((p: any) => 
          bidfoodIngredients.some(i => i.id === p.id)
        )

        selectedProducts.forEach((product: any) => {
          if (product.contains) {
            const allergens = product.contains.split(',').map((a: string) => a.trim().toLowerCase())
            if (allergens.includes('gluten')) allergenFlags.hasGluten = true
            if (allergens.includes('dairy')) allergenFlags.hasDairy = true
            if (allergens.includes('soy')) allergenFlags.hasSoy = true
            if (allergens.includes('onion') || allergens.includes('garlic')) allergenFlags.hasOnionGarlic = true
            if (allergens.includes('sesame')) allergenFlags.hasSesame = true
            if (allergens.includes('nuts')) allergenFlags.hasNuts = true
            if (allergens.includes('egg')) allergenFlags.hasEgg = true
          }
        })

        // Update form with new allergen flags
        Object.entries(allergenFlags).forEach(([key, value]) => {
          form.setValue(key as keyof typeof allergenFlags, value)
        })
      } catch (err) {
        console.error('Error updating allergen flags:', err)
      }
    }

    if (bidfoodIngredients.length > 0) {
      updateAllergenFlags()
    }
  }, [ingredients, form])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate ingredient quantities and costs
      const validatedIngredients = values.ingredients.map(ingredient => ({
        ...ingredient,
        quantity: Number(ingredient.quantity),
        cost: Number(ingredient.cost)
      }))

      // Calculate total cost
      const totalCost = validatedIngredients.reduce((sum, ingredient) => 
        sum + (ingredient.quantity * ingredient.cost), 0
      )

      const payload = {
        ...values,
        ingredients: validatedIngredients,
        totalCost,
        id: editingComponent?.id // Include id if editing
      }

      console.log('Submitting component payload:', JSON.stringify(payload, null, 2))

      const url = editingComponent 
        ? `/api/components/${editingComponent.id}`
        : '/api/components';
      
      const response = await fetch(url, {
        method: editingComponent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Server error response:', responseData);
        throw new Error(responseData.error || 'Failed to save component');
      }

      console.log('Component saved successfully:', responseData);
      
      // Update components list based on whether we're editing or creating
      if (editingComponent) {
        setComponents(components.map(c => 
          c.id === editingComponent.id ? responseData : c
        ));
      } else {
        setComponents([...components, responseData]);
      }
      
      // Reset form and close dialog
      setIsDialogOpen(false);
      setEditingComponent(null);
      form.reset({
        name: "",
        description: "",
        ingredients: [],
        hasGluten: false,
        hasDairy: false,
        hasSoy: false,
        hasOnionGarlic: false,
        hasSesame: false,
        hasNuts: false,
        hasEgg: false,
        isVegetarian: false,
        isVegan: false,
        isHalal: false,
        isComponentListItem: true,
        totalCost: 0
      });
    } catch (error) {
      console.error('Error saving component:', error);
      setError(error instanceof Error ? error.message : 'Failed to save component');
    } finally {
      setIsSubmitting(false)
    }
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component)
    form.reset({
      name: component.name,
      description: component.description,
      ingredients: component.ingredients.map(ingredient => ({
        ...ingredient,
        source: ingredient.source as IngredientSource
      })),
      hasGluten: component.hasGluten,
      hasDairy: component.hasDairy,
      hasSoy: component.hasSoy,
      hasOnionGarlic: component.hasOnionGarlic,
      hasSesame: component.hasSesame,
      hasNuts: component.hasNuts,
      hasEgg: component.hasEgg,
      isVegetarian: component.isVegetarian,
      isVegan: component.isVegan,
      isHalal: component.isHalal,
      isComponentListItem: component.isComponentListItem,
      totalCost: component.totalCost
    })
    setIsDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingComponent(null)
    form.reset({
      name: "",
      description: "",
      ingredients: [],
      hasGluten: false,
      hasDairy: false,
      hasSoy: false,
      hasOnionGarlic: false,
      hasSesame: false,
      hasNuts: false,
      hasEgg: false,
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
      isComponentListItem: true,
      totalCost: 0
    })
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Components</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>Add New Component</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? "Edit Component" : "Add New Component"}
              </DialogTitle>
              <DialogDescription>
                {editingComponent
                  ? "Update the component information below."
                  : "Fill in the component information below."}
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
                        <Input placeholder="Component name" {...field} />
                      </FormControl>
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
                          placeholder="Component description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ingredients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ingredients</FormLabel>
                      <FormControl>
                        <IngredientSelector
                          onIngredientsChange={field.onChange}
                          initialIngredients={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Allergen Checkboxes */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hasGluten"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Gluten</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasDairy"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Dairy</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasSoy"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Soy</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasOnionGarlic"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Onion/Garlic</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasSesame"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Sesame</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasNuts"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Nuts</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasEgg"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Contains Egg</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dietary Checkboxes */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isVegetarian"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Vegetarian</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isVegan"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Vegan</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isHalal"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Halal</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Component List Item Checkbox */}
                <FormField
                  control={form.control}
                  name="isComponentListItem"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Component list item</FormLabel>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save"}
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

      {isLoading && (!components || components.length === 0) ? (
        <div className="text-center py-8">Loading components...</div>
      ) : (!components || components.length === 0) ? (
        <div className="text-center py-8">
          No components found. Add your first component to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Allergens</TableHead>
                <TableHead>Dietary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(components || []).map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-medium">{component.name}</TableCell>
                  <TableCell>{component.description}</TableCell>
                  <TableCell>${component.totalCost.toFixed(2)}</TableCell>
                  <TableCell>
                    {[
                      component.hasGluten && "Gluten",
                      component.hasDairy && "Dairy",
                      component.hasSoy && "Soy",
                      component.hasOnionGarlic && "Onion/Garlic",
                      component.hasSesame && "Sesame",
                      component.hasNuts && "Nuts",
                      component.hasEgg && "Egg",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    {[
                      component.isVegetarian && "Vegetarian",
                      component.isVegan && "Vegan",
                      component.isHalal && "Halal",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(component)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
} 