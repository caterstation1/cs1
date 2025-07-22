'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { IngredientSelector } from './IngredientSelector';

// Define the product schema (same as in ProductsTab)
const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  addon: z.string().optional(),
  handle: z.string().optional(),
  meat1: z.string().optional(),
  meat2: z.string().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  serveware: z.string().optional(),
  timerA: z.number().nullable().optional(),
  timerB: z.number().nullable().optional(),
  skuSearch: z.string().optional(),
  variantSku: z.string().optional(),
  variant_title: z.string().optional(),
  ingredients: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    cost: z.number(),
    source: z.enum(['Gilmours', 'Bidfood', 'Other', 'Components', 'Products']),
    unit: z.string(),
  })).optional(),
  sellingPrice: z.number().nullable().optional(),
  allergenFree: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  dairyFree: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  halal: z.boolean().optional(),
  kosher: z.boolean().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export type Product = ProductFormData & {
  id: string;
  totalCost: number;
  realizedMargin?: number;
};

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sku?: string;
  productTitle?: string;
  productId?: string;
  variantTitle?: string;
  onProductUpdated?: (product: Product) => void;
}

export function ProductEditModal({ 
  isOpen, 
  onClose, 
  sku, 
  productTitle,
  productId,
  variantTitle,
  onProductUpdated 
}: ProductEditModalProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      ingredients: [],
      addon: '',
      variant_title: '',
      allergenFree: false,
      glutenFree: false,
      dairyFree: false,
      vegetarian: false,
      vegan: false,
      halal: false,
      kosher: false,
      sellingPrice: 0,
    },
    mode: 'onChange',
  });

  // Fetch product by SKU or productId when modal opens
  useEffect(() => {
    if (isOpen && (sku || productId)) {
      fetchProductByIdentifier(sku, productId);
    }
  }, [isOpen, sku, productId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setProduct(null);
      setError(null);
    }
  }, [isOpen, form]);

  // Fetch product by SKU or productId
  const fetchProductByIdentifier = async (sku?: string, productId?: string) => {
    try {
      setLoading(true);
      setError(null);
      let foundProduct = null;
      if (sku) {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(sku)}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        const products = await response.json();
        foundProduct = products.find((p: any) => p.variantSku === sku);
      }
      if (!foundProduct && productId) {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
          foundProduct = await response.json();
        }
      }
      if (foundProduct) {
        setProduct(foundProduct);
        const productWithDefaults = {
          ...foundProduct,
          ingredients: foundProduct.ingredients?.map((i: any) => ({
            ...i,
            unit: i.unit || 'g',
            source: i.source || 'Other',
          })) || [],
          timerA: foundProduct.timerA || null,
          timerB: foundProduct.timerB || null,
          sellingPrice: foundProduct.sellingPrice || null,
          variant_title: foundProduct.variant_title || '',
        };
        form.reset(productWithDefaults);
      } else {
        setProduct(null);
        setError(null);
        form.reset({
          name: productTitle || '',
          description: '',
          addon: '',
          handle: '',
          meat1: '',
          meat2: '',
          option1: '',
          option2: '',
          serveware: '',
          timerA: null,
          timerB: null,
          skuSearch: '',
          variantSku: sku || '',
          variant_title: variantTitle || '',
          ingredients: [],
          sellingPrice: 0,
          allergenFree: false,
          glutenFree: false,
          dairyFree: false,
          vegetarian: false,
          vegan: false,
          halal: false,
          kosher: false,
        });
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch product');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    // Allow creation even if product is null
    try {
      setIsSubmitting(true);
      setError(null);

      const dataToSend = {
        ...data,
        id: product ? product.id : undefined,
        ingredients: data.ingredients || [],
        timerA: data.timerA || null,
        timerB: data.timerB || null,
        sellingPrice: data.sellingPrice || null,
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        throw new Error('Failed to update product');
      }

      const updatedProduct = await response.json();
      
      // Call the callback to notify parent component
      if (onProductUpdated) {
        onProductUpdated(updatedProduct);
      }
      
      onClose();
    } catch (err) {
      console.error('Error updating product:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Edit Product' : 'Product Details'}
          </DialogTitle>
          <DialogDescription>
            {productTitle && `Editing: ${productTitle}`}
            {form.watch('variant_title') && ` - ${form.watch('variant_title')}`}
            {sku && ` (SKU: ${sku})`}
            {productId && !sku && ` (Product ID: ${productId})`}
            {/* Inline options summary */}
            {(form.watch('option1') || form.watch('option2') || form.watch('serveware') || form.watch('addon') || form.watch('meat1') || form.watch('meat2')) && (
              <span className="ml-1 text-gray-500">
                (
                {[
                  form.watch('option1') && `Option 1: ${form.watch('option1')}`,
                  form.watch('option2') && `Option 2: ${form.watch('option2')}`,
                  form.watch('serveware') && `Serveware: ${form.watch('serveware')}`,
                  form.watch('addon') && `Addon: ${form.watch('addon')}`,
                  form.watch('meat1') && `Meat 1: ${form.watch('meat1')}`,
                  form.watch('meat2') && `Meat 2: ${form.watch('meat2')}`
                ].filter(Boolean).join(', ')}
                )
              </span>
            )}
          </DialogDescription>
          {/* Product summary block */}
          {(product || form.watch('name')) && (
            <div className="mt-2 p-2 bg-gray-50 rounded border text-sm text-gray-700">
              <div><b>Description:</b> {form.watch('description') || '-'}</div>
              <div><b>Option 1:</b> {form.watch('option1') || '-'}</div>
              <div><b>Option 2:</b> {form.watch('option2') || '-'}</div>
              <div><b>Serveware:</b> {form.watch('serveware') || '-'}</div>
              <div><b>Addon:</b> {form.watch('addon') || '-'}</div>
              <div><b>Meat 1:</b> {form.watch('meat1') || '-'}</div>
              <div><b>Meat 2:</b> {form.watch('meat2') || '-'}</div>
            </div>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {(!loading && !error) && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...form.register('description')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon">Addon</Label>
                <Input id="addon" {...form.register('addon')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">Handle</Label>
                <Input id="handle" {...form.register('handle')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meat1">Meat 1</Label>
                <Input id="meat1" {...form.register('meat1')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meat2">Meat 2</Label>
                <Input id="meat2" {...form.register('meat2')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option1">Option 1</Label>
                <Input id="option1" {...form.register('option1')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="option2">Option 2</Label>
                <Input id="option2" {...form.register('option2')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serveware">Serveware</Label>
                <Input id="serveware" {...form.register('serveware')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timerA">Timer A (minutes)</Label>
                <Input 
                  id="timerA" 
                  type="number" 
                  {...form.register('timerA', { valueAsNumber: true })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timerB">Timer B (minutes)</Label>
                <Input 
                  id="timerB" 
                  type="number" 
                  {...form.register('timerB', { valueAsNumber: true })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skuSearch">SKU Search</Label>
                <Input id="skuSearch" {...form.register('skuSearch')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variantSku">Variant SKU</Label>
                <Input id="variantSku" {...form.register('variantSku')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant_title">Variant Title</Label>
                <Input id="variant_title" {...form.register('variant_title')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price</Label>
                <Input 
                  id="sellingPrice" 
                  type="number" 
                  step="0.01"
                  {...form.register('sellingPrice', { valueAsNumber: true })} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ingredients</Label>
              <IngredientSelector
                initialIngredients={form.watch('ingredients')}
                onIngredientsChange={(newIngredients) => form.setValue('ingredients', newIngredients)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (product ? 'Updating...' : 'Creating...') : (product ? 'Update Product' : 'Create Product')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 