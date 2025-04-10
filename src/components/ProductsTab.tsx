import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IngredientSelector } from './IngredientSelector';
import { Upload, ArrowUpDown } from 'lucide-react';

// Define the product schema
const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
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
  ingredients: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    cost: z.number(),
    source: z.enum(['Gilmours', 'Bidfood', 'Other', 'Components', 'Products']),
    unit: z.string(),
  })),
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

interface ProductsTabProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  isLoading: boolean;
  error: string | null;
}

interface IngredientSelectorProps {
  ingredients: ProductFormData['ingredients'];
  onIngredientsChange: (ingredients: ProductFormData['ingredients']) => void;
}

export function ProductsTab({ products: initialProducts, setProducts, isLoading, error: externalError }: ProductsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(externalError);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ imported: number; failed: number } | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Product | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [products, setLocalProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    setLocalProducts(initialProducts);
  }, [initialProducts]);

  const handleSort = (column: keyof Product) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
    if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    }

    return 0;
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      ingredients: [],
      addon: '',
      allergenFree: false,
      glutenFree: false,
      dairyFree: false,
      vegetarian: false,
      vegan: false,
      halal: false,
      kosher: false,
      sellingPrice: 0,
    },
  });

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    }
  };

  const onSubmit = async (values: ProductFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Prepare the data to send
      const dataToSend = {
        ...values,
        // Include the id if we're editing an existing product
        ...(editingProduct ? { id: editingProduct.id } : {}),
        // Ensure optional fields are properly handled
        timerA: values.timerA || undefined,
        timerB: values.timerB || undefined,
        sellingPrice: values.sellingPrice || undefined,
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save product');
      }

      const savedProduct = await response.json();
      
      if (editingProduct) {
        // Update existing product in the list
        setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
      } else {
        // Add new product to the list
        setProducts([...products, savedProduct]);
      }
      
      setIsDialogOpen(false);
      form.reset();
    } catch (err) {
      console.error('Error saving product:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving the product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description,
      addon: product.addon || '',
      handle: product.handle || '',
      meat1: product.meat1 || '',
      meat2: product.meat2 || '',
      option1: product.option1 || '',
      option2: product.option2 || '',
      serveware: product.serveware || '',
      timerA: product.timerA || undefined,
      timerB: product.timerB || undefined,
      skuSearch: product.skuSearch || '',
      variantSku: product.variantSku || '',
      ingredients: product.ingredients || [],
      sellingPrice: product.sellingPrice || undefined,
      allergenFree: product.allergenFree || false,
      glutenFree: product.glutenFree || false,
      dairyFree: product.dairyFree || false,
      vegetarian: product.vegetarian || false,
      vegan: product.vegan || false,
      halal: product.halal || false,
      kosher: product.kosher || false,
    });
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products', {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload products');
      }

      const result = await response.json();
      setUploadResult(result);
      
      // Refresh the products list
      await fetchProducts();
    } catch (err) {
      console.error('Error uploading products:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Products</h2>
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <Button variant="outline" disabled={isUploading}>
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload CSV'}
            </Button>
          </div>
          <Button onClick={handleAdd}>Add Product</Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {uploadResult && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Successfully imported {uploadResult.imported} products.
          {uploadResult.failed > 0 && ` Failed to import ${uploadResult.failed} products.`}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                Name
                {sortColumn === 'name' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('description')}
            >
              <div className="flex items-center gap-1">
                Description
                {sortColumn === 'description' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('addon')}
            >
              <div className="flex items-center gap-1">
                Addon
                {sortColumn === 'addon' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('variantSku')}
            >
              <div className="flex items-center gap-1">
                Variant SKU
                {sortColumn === 'variantSku' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('totalCost')}
            >
              <div className="flex items-center gap-1">
                Total Cost
                {sortColumn === 'totalCost' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('sellingPrice')}
            >
              <div className="flex items-center gap-1">
                Selling Price
                {sortColumn === 'sellingPrice' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('realizedMargin')}
            >
              <div className="flex items-center gap-1">
                Realized Margin
                {sortColumn === 'realizedMargin' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                )}
              </div>
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.description}</TableCell>
              <TableCell>{product.addon || '-'}</TableCell>
              <TableCell>{product.variantSku || '-'}</TableCell>
              <TableCell>${product.totalCost?.toFixed(2) || '0.00'}</TableCell>
              <TableCell>${product.sellingPrice?.toFixed(2) || '-'}</TableCell>
              <TableCell>{product.realizedMargin ? `${product.realizedMargin.toFixed(1)}%` : '-'}</TableCell>
              <TableCell>
                <Button variant="outline" onClick={() => handleEdit(product)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
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
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingProduct ? 'Update' : 'Create'} Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 