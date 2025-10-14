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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { ComponentCard } from './ComponentCard'
import { Dispatch, SetStateAction, useRef, useLayoutEffect } from 'react'
import jsPDF from 'jspdf'
// html-to-image lacks types; import via require at runtime to satisfy TS
const htmlToImage = require('html-to-image') as { toPng: (node: HTMLElement, opts?: any) => Promise<string> }
import { IngredientSelector } from './IngredientSelector'
import { Resolver } from "react-hook-form"
import { useToast } from '@/components/ui/use-toast'

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
  producedQuantity?: number
  producedUnit?: string
  rawWeight?: number | null
  cookedWeight?: number | null
  trimWasteWeight?: number | null
  weightUnit?: string | null
  costPerOutputUnit?: number
  normalizedOutputUnit?: string
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
  images?: { id: string; publicId: string; url: string; alt?: string | null; position: number }[]
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
  prepCategory: z.string().optional(),
  ingredients: z.array(z.object({
    source: z.enum(["Bidfood", "Gilmours", "Other", "Components", "Products"]) as z.ZodType<IngredientSource>,
    id: z.string(),
    name: z.string(),
    quantity: z.number().min(0),
    cost: z.number().min(0),
    unit: z.string()
  })),
  producedQuantity: z.coerce.number().min(0.000001, 'Produced quantity must be > 0').default(1),
  producedUnit: z.string().default('unit'),
  rawWeight: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
  cookedWeight: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
  trimWasteWeight: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
  weightUnit: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
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
  prepCategory?: string;
  ingredients: {
    source: IngredientSource;
    id: string;
    name: string;
    quantity: number;
    cost: number;
    unit: string;
  }[];
  producedQuantity: number;
  producedUnit: string;
  rawWeight?: number | null;
  cookedWeight?: number | null;
  trimWasteWeight?: number | null;
  weightUnit?: string | null;
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
  const [localImages, setLocalImages] = useState<{ publicId?: string; url: string; alt?: string; position?: number }[]>([])
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [viewComponent, setViewComponent] = useState<Component | null>(null)
  const [downloadTarget, setDownloadTarget] = useState<Component | null>(null)
  const hiddenCardRef = useRef<HTMLDivElement>(null)
  const [isDescPreview, setIsDescPreview] = useState(false)
  const { toast } = useToast()

  const simpleMarkdownToHtml = (text: string): string => {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    let html = escapeHtml(text || '')
    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Simple headings: lines starting with # or ##
    html = html.replace(/^##\s*(.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^#\s*(.+)$/gm, '<h2>$1</h2>')
    // Bullet lists: lines starting with - or *
    html = html.replace(/^(?:- |\* )(.*)(?:\n(?!\n)(?:- |\* ).*)*/gm, (block) => {
      const items = block.split(/\n/).map(l => l.replace(/^(?:- |\* )/, '')).map(i => `<li>${i}</li>`).join('')
      return `<ul>${items}</ul>`
    })
    // Paragraphs and breaks
    html = html.replace(/\n\n+/g, '</p><p>')
    html = html.replace(/\n/g, '<br/>')
    return `<p>${html}</p>`
  }

  useLayoutEffect(() => {
    const doExport = async () => {
      if (!downloadTarget || !hiddenCardRef.current) return
      
      // Wait for component to fully render with all nested content and padding
      await new Promise(resolve => setTimeout(resolve, 500))
      
      try {
        const node = hiddenCardRef.current as HTMLElement
        const rect = node.getBoundingClientRect()
        const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 2 })
        const orientation = rect.width >= rect.height ? 'landscape' : 'portrait'
        const pdf = new jsPDF({ orientation, unit: 'px', format: [rect.width, rect.height] })
        // Fill the entire page with the card image (no white margins)
        pdf.addImage(dataUrl, 'PNG', 0, 0, rect.width, rect.height)
        pdf.save(`${downloadTarget.name.replace(/\s+/g, '_')}_card.pdf`)
      } catch (e) {
        console.error('Failed to export PDF:', e)
        alert('Failed to export PDF. Please try again.')
      } finally {
        setDownloadTarget(null)
      }
    }
    void doExport()
  }, [downloadTarget])

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
      prepCategory: "",
      ingredients: [],
      producedQuantity: 1,
      producedUnit: 'unit',
      rawWeight: null,
      cookedWeight: null,
      trimWasteWeight: null,
      weightUnit: null,
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
        id: editingComponent?.id, // Include id if editing
        images: localImages.map((img, idx) => ({
          publicId: img.publicId,
          url: img.url,
          alt: img.alt,
          position: img.position ?? idx,
        }))
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
      
      // Close dialog and reset UI immediately for snappier UX
      setIsDialogOpen(false);
      setEditingComponent(null);
      form.reset({
        name: "",
        description: "",
        ingredients: [],
        producedQuantity: 1,
        producedUnit: 'unit',
        rawWeight: null,
        cookedWeight: null,
        trimWasteWeight: null,
        weightUnit: null,
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
      setLocalImages([])

      // Trigger cost recalculation in the background (non-blocking)
      try {
        void fetch('/api/products/recalculate-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json().catch(() => null)
              console.log('✅ Product costs updated:', data)
            } else {
              console.warn('⚠️ Failed to recalculate product costs')
            }
          })
          .catch((err) => console.warn('⚠️ Error during cost recalculation:', err))
        toast({ title: 'Saving...', description: 'Recalculating product costs in background' })
      } catch {}
    } catch (error) {
      console.error('Error saving component:', error);
      setError(error instanceof Error ? error.message : 'Failed to save component');
    } finally {
      setIsSubmitting(false)
    }
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component)
    setLocalImages((component.images || []).map(img => ({ publicId: img.publicId, url: img.url, alt: img.alt || undefined, position: img.position })))
    form.reset({
      name: component.name,
      description: component.description,
      prepCategory: (component as any).prepCategory || '',
      ingredients: component.ingredients.map(ingredient => ({
        ...ingredient,
        source: ingredient.source as IngredientSource
      })),
      producedQuantity: component.producedQuantity ?? 1,
      producedUnit: component.producedUnit ?? 'unit',
      rawWeight: component.rawWeight ?? null,
      cookedWeight: component.cookedWeight ?? null,
      trimWasteWeight: component.trimWasteWeight ?? null,
      weightUnit: component.weightUnit ?? null,
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

  // Prep category presets and adder
  const presetCategories = ["Bakery","Butchery","Hot kitchen","Cold kitchen","Desserts","Pre day prep"]
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const allCategories = Array.from(new Set([...(presetCategories as string[]), ...customCategories]))

  const handleAdd = () => {
    setEditingComponent(null)
    setLocalImages([])
    form.reset({
      name: "",
      description: "",
      prepCategory: "",
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

  // Cloudinary unsigned upload helper
  const uploadToCloudinary = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '')
    const folder = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_FOLDER || 'caterstation/components'
    form.append('folder', folder)
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) throw new Error('Cloudinary cloud name not configured')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json()
    return { publicId: data.public_id as string, url: data.secure_url as string }
  }

  const onFilesSelected = async (files: FileList | null) => {
    if (!files) return
    const toUpload = Array.from(files).slice(0, Math.max(0, 5 - localImages.length))
    const uploaded: { publicId: string; url: string }[] = []
    for (const file of toUpload) {
      const u = await uploadToCloudinary(file)
      uploaded.push(u)
    }
    const merged = [...localImages, ...uploaded.map((u, idx) => ({ ...u, position: (localImages.length + idx) }))]
    setLocalImages(merged)
  }

  const removeImage = (idx: number) => {
    const next = [...localImages]
    next.splice(idx, 1)
    setLocalImages(next.map((img, i) => ({ ...img, position: i })))
  }

  const openView = (component: Component) => {
    setViewComponent(component)
    setIsViewOpen(true)
  }

  const enrichIngredients = async (items: any[]) => {
    const base = items || []
    const enriched = await Promise.all(base.map(async (i: any) => {
      try {
        if (i.source === 'Bidfood' && i.id) {
          const res = await fetch(`/api/bidfood/${i.id}`)
          if (res.ok) {
            const p = await res.json()
            return { ...i, productCode: p.productCode || i.productCode, brand: p.brand || i.brand }
          }
        }
        if (i.source === 'Gilmours' && i.id) {
          const res = await fetch(`/api/gilmours/${i.id}`)
          if (res.ok) {
            const p = await res.json()
            return { ...i, sku: p.sku || i.sku, brand: p.brand || i.brand }
          }
        }
      } catch {}
      return i
    }))
    return enriched
  }

  const exportCardPdf = async (component: Component) => {
    console.log('Starting exportCardPdf for component:', component.name)
    
    // Enrich ingredients with brand and code/sku so the download snapshot includes them
    const enriched = await enrichIngredients(component.ingredients || [])
    console.log('Enriched ingredients:', enriched)
    
    // Also preload component breakdowns for components that are ingredients
    const enrichedWithBreakdowns = await Promise.all(enriched.map(async (ing: any) => {
      console.log('Processing ingredient:', ing.name, 'source:', ing.source)
      
      if ((ing.source || '').toLowerCase() === 'components') {
        console.log('Fetching component breakdown for:', ing.name, 'source:', ing.source)
        try {
          let componentData = null
          
          // Prefer by id when available
          if (ing.id) {
            console.log('Fetching by ID:', ing.id)
            const res = await fetch(`/api/components/${ing.id}`)
            if (res.ok) {
              componentData = await res.json()
              console.log('Fetched component by ID:', componentData.name, 'ingredients:', componentData.ingredients)
            }
          }
          
          // Fallback: fetch catalog and match by name
          if (!componentData) {
            console.log('Fetching by name:', ing.name)
            const res = await fetch('/api/components')
            if (res.ok) {
              const list = await res.json()
              const arr = Array.isArray(list) ? list : (list.components || [])
              const key = (ing.name || '').toLowerCase().trim()
              componentData = arr.find((c: any) => (c?.name || '').toLowerCase().trim() === key)
              console.log('Found component by name:', componentData?.name, 'ingredients:', componentData?.ingredients)
            }
          }
          
          if (componentData && componentData.ingredients && componentData.ingredients.length > 0) {
            console.log('Preloading breakdown for:', ing.name, 'ingredients:', componentData.ingredients)
            // Enrich the breakdown ingredients with brand/code data
            const enrichedBreakdown = await enrichIngredients(componentData.ingredients)
            console.log('Enriched breakdown for:', ing.name, 'enriched:', enrichedBreakdown)
            return { ...ing, _componentBreakdown: enrichedBreakdown }
          } else {
            console.log('No ingredients found for component:', ing.name)
          }
        } catch (error) {
          console.error('Failed to fetch component breakdown for download:', error)
        }
      }
      return ing
    }))
    
    console.log('Final enriched ingredients with breakdowns:', enrichedWithBreakdowns)
    setDownloadTarget({ ...component, ingredients: enrichedWithBreakdowns } as any)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Components</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>Add New Component</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {/* Prep Category selector with add button */}
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
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
                            {allCategories.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const v = prompt('Add new category')?.trim()
                      if (v) setCustomCategories(prev => Array.from(new Set([...prev, v])))
                    }}
                  >
                    +
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      {!isDescPreview ? (
                        <>
                          <FormControl>
                            <Textarea
                              placeholder="Component description"
                              {...field}
                            />
                          </FormControl>
                          <div className="text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsDescPreview(true)}>
                              Preview
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded border p-3 bg-muted/20">
                          {/* eslint-disable-next-line react/no-danger */}
                          <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(field.value || '') }} />
                          <div className="text-right mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsDescPreview(false)}>
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Images uploader (max 5) */}
                <div className="space-y-2">
                  <FormLabel>Images</FormLabel>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => onFilesSelected(e.target.files)}
                  />
                  {localImages.length > 0 && (
                    <div className="grid grid-cols-5 gap-2">
                      {localImages.map((img, idx) => (
                        <div key={idx} className="relative rounded overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.alt || ''} className="h-24 w-full object-cover" />
                          <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-white/80 text-xs px-1 rounded">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">Up to 5 images. Camera capture supported on iPad/iPhone.</p>
                </div>

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
                {/* Yield section */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="producedQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produced Quantity (final usable)</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" min="0" placeholder="e.g., 2.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="producedUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produced Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="kg | g | l | ml | unit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Cooking loss (optional) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rawWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raw Weight (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" min="0" placeholder="e.g., 15" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cookedWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooked Weight (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" min="0" placeholder="e.g., 9.4" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trimWasteWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trim/Waste Weight (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" min="0" placeholder="e.g., 0.8" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weightUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="kg | g" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Derived display */}
                {(() => {
                  const producedQuantity = form.watch('producedQuantity') || 0;
                  const producedUnit = (form.watch('producedUnit') || 'unit').toLowerCase();
                  const totalCost = form.watch('totalCost') || 0;
                  const toBase = (qty: number, unit: string) => {
                    if (unit === 'g') return { value: qty / 1000, unit: 'kg' };
                    if (unit === 'ml') return { value: qty / 1000, unit: 'l' };
                    if (unit === 'kg' || unit === 'l') return { value: qty, unit };
                    return { value: qty, unit: 'unit' };
                  };
                  const base = toBase(producedQuantity, producedUnit);
                  const costPer = base.value > 0 ? totalCost / base.value : 0;
                  const raw = form.watch('rawWeight');
                  const cooked = form.watch('cookedWeight');
                  const trim = form.watch('trimWasteWeight') || 0;
                  const netInput = raw != null ? (raw - (trim || 0)) : null;
                  const yieldFactor = (netInput && cooked != null && netInput > 0) ? (cooked / netInput) : null;
                  return (
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Normalized output unit: <strong>{base.unit}</strong></div>
                      <div>Cost per {base.unit}: <strong>${costPer.toFixed(2)}</strong></div>
                      {yieldFactor != null && !Number.isNaN(yieldFactor) && (
                        <div>Yield factor: <strong>{(yieldFactor * 100).toFixed(1)}%</strong></div>
                      )}
                    </div>
                  );
                })()}
                
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
        {/* View dialog for card preview */}
        </div>
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-fit">
            <DialogHeader>
              <DialogTitle>Component Card</DialogTitle>
            </DialogHeader>
            {viewComponent && (
              <ComponentCard
                name={viewComponent.name}
                description={viewComponent.description}
                images={(viewComponent.images || []).slice(0,2).map(i => ({ url: i.url, alt: i.alt }))}
                ingredients={(viewComponent.ingredients || []).map((i:any)=>({
                  name: i.name,
                  quantity: i.quantity,
                  unit: i.unit,
                  source: i.source,
                  id: i.id,
                  code: (i.source === 'Bidfood') ? (i.productCode || '') : (i.source === 'Gilmours') ? (i.sku || '') : '',
                  supplier: i.source,
                  brand: i.brand,
                }))}
                allergens={[
                  viewComponent.hasGluten && 'Gluten',
                  viewComponent.hasDairy && 'Dairy',
                  viewComponent.hasSoy && 'Soy',
                  viewComponent.hasOnionGarlic && 'Onion/Garlic',
                  viewComponent.hasSesame && 'Sesame',
                  viewComponent.hasNuts && 'Nuts',
                  viewComponent.hasEgg && 'Egg',
                ].filter(Boolean) as string[]}
                dietary={[
                  viewComponent.isVegetarian && 'Vegetarian',
                  viewComponent.isVegan && 'Vegan',
                  viewComponent.isHalal && 'Halal',
                ].filter(Boolean) as string[]}
                producedQuantity={viewComponent.producedQuantity}
                producedUnit={viewComponent.producedUnit || viewComponent.normalizedOutputUnit}
              />
            )}
          </DialogContent>
        </Dialog>

      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : null}

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
                <TableHead className="max-w-[360px]">Description</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Per-Unit</TableHead>
                <TableHead>Allergens</TableHead>
                <TableHead>Dietary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(components || []).map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-medium">{component.name}</TableCell>
                  <TableCell className="max-w-[360px] whitespace-nowrap overflow-hidden text-ellipsis">{component.description}</TableCell>
                  <TableCell>${component.totalCost.toFixed(2)}</TableCell>
                  <TableCell>
                    {(() => {
                      const unit = component.normalizedOutputUnit || component.producedUnit || 'unit'
                      const pq = component.producedQuantity && component.producedQuantity > 0 ? component.producedQuantity : 1
                      const baseUnit = (unit || 'unit').toLowerCase()
                      const toBase = (qty: number, u: string) => {
                        if (u === 'g') return { v: qty / 1000, u: 'kg' }
                        if (u === 'ml') return { v: qty / 1000, u: 'l' }
                        if (u === 'kg' || u === 'l') return { v: qty, u }
                        return { v: qty, u: 'unit' }
                      }
                      const base = toBase(pq, baseUnit)
                      const per = base.v > 0 ? component.totalCost / base.v : 0
                      return `$${per.toFixed(2)} / ${base.u}`
                    })()}
                  </TableCell>
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
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const c = component
                            const enriched = await enrichIngredients(c.ingredients || [])
                            const rows: string[] = []
                            // Header row like your sheet
                            rows.push(['Brand','Source','Code/sku','Weight','Unit','Product'].join(','))
                            enriched.forEach((i: any) => {
                              const brand = i.brand || ''
                              const source = i.source || ''
                              const code = source === 'Bidfood' ? (i.productCode || i.id || '') : source === 'Gilmours' ? (i.sku || i.id || '') : '-'
                              const weight = i.quantity ?? ''
                              const unit = i.unit ?? ''
                              rows.push([brand,source,code,String(weight),unit,(i.name || '').replace(/,/g,';')].join(','))
                            })
                            // Yield row
                            rows.push(['Yeild','', '', String(c.producedQuantity ?? ''), (c.producedUnit || c.normalizedOutputUnit || '').toUpperCase(), ''].join(','))
                            // Blank spacer
                            rows.push(['','','','','',''].join(','))
                            // Description section
                            rows.push(['', '', '', '', '', 'Description'].join(','))
                            const desc = (c.description || '').replace(/\n/g,' ')
                            rows.push(['', '', '', '', '', desc.replace(/,/g,';')].join(','))
                            const csv = rows.join('\n')
                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${c.name.replace(/\s+/g,'_')}.csv`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                          } catch (e) {
                            alert('Failed to export CSV')
                          }
                        }}
                      >Download CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => openView(component)}>View</Button>
                      <Button variant="outline" size="sm" onClick={() => exportCardPdf(component)}>Download</Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(component)}>Edit</Button>
                      {/* Download button will export the card as PDF in a follow-up step */}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Hidden render target for PDF export */}
      <div style={{ position: 'absolute', left: -10000, top: 0 }}>
        {downloadTarget && (
          <div ref={hiddenCardRef} style={{
            // Match the card's intrinsic width for crisp export, height auto-adjusts
            width: 496,
            background: 'transparent'
          }}>
            <ComponentCard
              name={downloadTarget!.name}
              description={downloadTarget!.description}
              images={(downloadTarget!.images || []).slice(0,2).map(i => ({ url: i.url, alt: i.alt }))}
              ingredients={(downloadTarget!.ingredients || []).map((i:any)=>({
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                source: i.source,
                id: i.id,
                code: (i.source === 'Bidfood') ? (i.productCode || '') : (i.source === 'Gilmours') ? (i.sku || '') : '',
                supplier: i.source,
                brand: i.brand,
                _componentBreakdown: i._componentBreakdown, // Pass the preloaded breakdown data
              }))}
              allergens={[
                downloadTarget!.hasGluten && 'Gluten',
                downloadTarget!.hasDairy && 'Dairy',
                downloadTarget!.hasSoy && 'Soy',
                downloadTarget!.hasOnionGarlic && 'Onion/Garlic',
                downloadTarget!.hasSesame && 'Sesame',
                downloadTarget!.hasNuts && 'Nuts',
                downloadTarget!.hasEgg && 'Egg',
              ].filter(Boolean) as string[]}
              dietary={[
                downloadTarget!.isVegetarian && 'Vegetarian',
                downloadTarget!.isVegan && 'Vegan',
                downloadTarget!.isHalal && 'Halal',
              ].filter(Boolean) as string[]}
              producedQuantity={downloadTarget!.producedQuantity}
              producedUnit={downloadTarget!.producedUnit || downloadTarget!.normalizedOutputUnit}
              expandAll={true}
            />
          </div>
        )}
      </div>
    </div>
  )
} 