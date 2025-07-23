import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Edit, ExternalLink, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { IngredientSelector } from './IngredientSelector';
import { SetRuleModal } from './SetRuleModal';
import { ManageRulesModal } from './ManageRulesModal';
import { debounce } from 'lodash';

// Shopify product type
interface ShopifyProduct {
  product_id: string;
  product_title: string;
  handle: string;
  variant_id: string;
  variant_title: string;
  sku: string | null;
  price: number;
  inventoryQuantity: number;
  shopify_title: string;
  shopify_variant_title: string;
  shopify_sku: string | null;
  shopify_price: number;
  shopify_inventory: number;
  meat1: string | null;
  meat2: string | null;
  option1: string | null;
  option2: string | null;
  serveware: string | null;
  timerA: number | null;
  timerB: number | null;
  ingredients: any | null;
  totalCost: number;
  hasCustomData: boolean;
  customDataId: string | null;
  displayName: string | null;
}

// Form data schema
const customDataSchema = z.object({
  displayName: z.string().optional(),
  meat1: z.string().optional(),
  meat2: z.string().optional(),
  timer1: z.number().nullable().optional(),
  timer2: z.number().nullable().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  serveware: z.boolean().optional(),
  ingredients: z.any().optional(),
  totalCost: z.number().optional(),
});

type CustomDataFormData = z.infer<typeof customDataSchema>;

export function ProductsTab() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ShopifyProduct>('shopify_title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopifyProduct | null>(null);
  const [isSetRuleModalOpen, setIsSetRuleModalOpen] = useState(false);
  const [isManageRulesModalOpen, setIsManageRulesModalOpen] = useState(false);

  // Memoize the filtered and sorted products to prevent unnecessary re-renders
  const filteredAndSortedProducts = useMemo((): ShopifyProduct[] => {
    // Ensure products is always an array
    const productsArray = Array.isArray(products) ? products : [];
    let filtered = productsArray;
    
    if (searchTerm) {
      filtered = productsArray.filter(product => 
        product.shopify_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.shopify_variant_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.displayName && product.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField as keyof ShopifyProduct];
      const bValue = b[sortField as keyof ShopifyProduct];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, searchTerm, sortField, sortDirection]);

  // Debounced search handler
  const debouncedSetSearchTerm = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const form = useForm<CustomDataFormData>({
    resolver: zodResolver(customDataSchema),
    defaultValues: {
      displayName: '',
      meat1: '',
      meat2: '',
      timer1: null,
      timer2: null,
      option1: '',
      option2: '',
      serveware: false,
      ingredients: [],
      totalCost: 0,
    },
  });

  // Fetch products function
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/shopify/products');
      if (response.ok) {
      const data = await response.json();
        
        // Extract variants array from the response object
        const productsArray = data.variants || (Array.isArray(data) ? data : []);
        
        // Ensure we always set an array
        setProducts(Array.isArray(productsArray) ? productsArray : []);
      } else {
        console.error('Failed to fetch products:', response.status, response.statusText);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync products function
  const syncProducts = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Products synced successfully:', result);
        await fetchProducts(); // Refresh the products list
      } else {
        console.error('❌ Failed to sync products');
      }
    } catch (error) {
      console.error('❌ Error syncing products:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchProducts]);

  const applyRules = useCallback(async () => {
    setIsApplyingRules(true);
    try {
      console.log('🚀 Manually applying rules to all products...');
      const response = await fetch('/api/product-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-all' })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Rules applied successfully:', result);
        await fetchProducts(); // Refresh the products list
        alert(`Rules applied successfully! ${result.result.updated} products updated, ${result.result.errors} errors.`);
      } else {
        console.error('❌ Failed to apply rules');
        alert('Failed to apply rules. Check console for details.');
      }
    } catch (error) {
      console.error('❌ Error applying rules:', error);
      alert('Error applying rules. Check console for details.');
    } finally {
      setIsApplyingRules(false);
    }
  }, [fetchProducts]);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSort = useCallback((key: string) => {
    setSortField(key as keyof ShopifyProduct);
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const handleEdit = useCallback((product: ShopifyProduct) => {
    setEditingProduct(product);
    
    // Pre-fill form with existing data
    const formData = {
      displayName: product.displayName || '',
      meat1: product.meat1 || '',
      meat2: product.meat2 || '',
      timer1: product.timerA || null,
      timer2: product.timerB || null,
      option1: product.option1 || '',
      option2: product.option2 || '',
      serveware: product.serveware === 'Yes' || product.serveware === 'true' || (typeof product.serveware === 'boolean' && product.serveware),
      ingredients: product.ingredients || [],
      totalCost: product.totalCost || 0,
    };

    form.reset(formData);
    setIsDialogOpen(true);
  }, [form]);

  const handleSaveProduct = useCallback(async (data: CustomDataFormData) => {
    if (!editingProduct) return;

    try {
      const response = await fetch('/api/shopify/products/custom-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: editingProduct.variant_id,
          ...data
        })
      });

      if (response.ok) {
        console.log('✅ Product saved successfully, refreshing data...');
        
        // Refresh the products data from the server to ensure we have the latest data
        await fetchProducts();
        
        setIsDialogOpen(false);
        setEditingProduct(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to save product:', errorData);
        alert(`Failed to save product: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please try again.');
    }
  }, [editingProduct, fetchProducts]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading products...</div>;
  }

  const safeProducts: ShopifyProduct[] = filteredAndSortedProducts;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Products</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search products..."
            onChange={(e) => debouncedSetSearchTerm(e.target.value)}
            className="w-64"
          />
          <Button 
            onClick={syncProducts}
            disabled={isSyncing}
            variant="outline"
            className="flex items-center gap-1"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Products'}
          </Button>
          <Button 
            onClick={applyRules}
            disabled={isApplyingRules}
            variant="outline"
            className="flex items-center gap-1"
          >
            {isApplyingRules ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {isApplyingRules ? 'Applying Rules...' : 'Apply Rules'}
          </Button>
          <Button 
            onClick={() => setIsSetRuleModalOpen(true)}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            Set Rule
          </Button>
          <Button 
            onClick={() => setIsManageRulesModalOpen(true)}
            variant="outline"
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            Manage Rules
            </Button>
        </div>
      </div>

      <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('shopify_title')}
                  className="flex items-center gap-1"
                >
                  Product Name
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
            </TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Custom Data</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {safeProducts.map((product: ShopifyProduct) => (
              <TableRow key={product.variant_id} className="cursor-pointer" onClick={() => handleEdit(product)}>
                <TableCell>
                  <div>
                    <div className="font-medium">{product.shopify_title}</div>
                    {product.displayName && (
                      <div className="text-sm text-gray-500">{product.displayName}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.shopify_variant_title}</TableCell>
                <TableCell>{product.shopify_sku}</TableCell>
                <TableCell>${product.shopify_price}</TableCell>
                <TableCell>{product.shopify_inventory}</TableCell>
                <TableCell>
                  {product.hasCustomData && (
                    <Badge variant="secondary">Has Custom Data</Badge>
                  )}
                </TableCell>
              <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(product);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      {/* Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              {editingProduct ? (
                <div className="space-y-2">
                  <div><strong>Shopify Product:</strong> {editingProduct.shopify_title}</div>
                  <div><strong>Variant:</strong> {editingProduct.shopify_variant_title}</div>
                  <div><strong>SKU:</strong> {editingProduct.shopify_sku}</div>
                  <div><strong>Price:</strong> ${editingProduct.shopify_price}</div>
                  {editingProduct.option1 && <div><strong>Option 1:</strong> {editingProduct.option1}</div>}
                  {editingProduct.option2 && <div><strong>Option 2:</strong> {editingProduct.option2}</div>}
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSaveProduct)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  {...form.register('displayName')}
                  placeholder="Custom display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meat1">Meat 1</Label>
                <Input
                  id="meat1"
                  {...form.register('meat1')}
                  placeholder="e.g., Chicken, Beef"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meat2">Meat 2</Label>
                <Input
                  id="meat2"
                  {...form.register('meat2')}
                  placeholder="e.g., Pork, Lamb"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timer1">Timer 1 (minutes)</Label>
                <Input 
                  id="timer1"
                  type="number" 
                  {...form.register('timer1', { valueAsNumber: true })}
                  placeholder="e.g., 30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timer2">Timer 2 (minutes)</Label>
                <Input 
                  id="timer2"
                  type="number" 
                  {...form.register('timer2', { valueAsNumber: true })}
                  placeholder="e.g., 45"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="option1">Option 1</Label>
                <Input
                  id="option1"
                  {...form.register('option1')}
                  placeholder="e.g., Gluten Free"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="option2">Option 2</Label>
                <Input
                  id="option2"
                  {...form.register('option2')}
                  placeholder="e.g., Dairy Free"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Cost</Label>
                <Input 
                  id="totalCost"
                  type="number" 
                  step="0.01"
                  {...form.register('totalCost', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serveware">Serveware</Label>
                <div className="flex items-center space-x-2">
                  <input
                    id="serveware"
                    type="checkbox"
                    {...form.register('serveware')}
                    className="rounded"
                  />
                  <span>Include serveware</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ingredients & Components</Label>
              <IngredientSelector
                onIngredientsChange={(ingredients) => {
                  form.setValue('ingredients', ingredients);
                  // Calculate total cost from ingredients
                  const totalCost = ingredients.reduce((sum, ingredient) => {
                    return sum + (ingredient.cost * ingredient.quantity);
                  }, 0);
                  form.setValue('totalCost', totalCost);
                }}
                initialIngredients={form.watch('ingredients') || []}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set Rule Modal */}
      <SetRuleModal 
        isOpen={isSetRuleModalOpen}
        onClose={() => setIsSetRuleModalOpen(false)}
        onRuleApplied={(result) => {
          console.log('Rule applied:', result);
          // Refresh products to show updated data
          fetchProducts();
        }}
      />

      {/* Manage Rules Modal */}
      <ManageRulesModal 
        isOpen={isManageRulesModalOpen}
        onClose={() => setIsManageRulesModalOpen(false)}
        onRulesUpdated={() => {
          // Refresh products to show updated data
          fetchProducts();
        }}
      />
    </div>
  );
} 