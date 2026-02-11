import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ArrowUpDown, Edit, ExternalLink, Settings, RefreshCw, Loader2, Download, ChevronRight, ChevronDown, Plus, X, Package } from 'lucide-react';
import { IngredientSelector } from './IngredientSelector';
import { SetRuleModal } from './SetRuleModal';
import { ManageRulesModal } from './ManageRulesModal';
import { debounce } from 'lodash';

// New grouped structure - Product with variants
interface ShopifyProduct {
  id: string;
  shopifyProductId: string;
  productTitle: string;
  displayName?: string;
  heroImageUrl?: string;
  shopifyVendor?: string;
  shopifyMarket?: string;
  isActive: boolean;
  baseIngredients?: any;
  isPartyPackDefault?: boolean;
  bundleDefaultItems?: Array<{ variantId: string; quantity: number }>;
  bakery?: boolean;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

interface ProductVariant {
  id: string;
  variantId: string;
  productId: string;
  shopifySku?: string;
  shopifyName: string;
  shopifyTitle: string;
  shopifyPrice: string | number;
  shopifyInventory: number;
  displayName?: string;
  meat1?: string;
  meat2?: string;
  timer1?: number | null;
  timer2?: number | null;
  option1?: string;
  option2?: string;
  serveware: boolean;
  isDraft: boolean;
  ingredients?: any;
  totalCost?: number;
  // Bundle override
  isPartyPack?: boolean;
  bundleItems?: Array<{ variantId: string; quantity: number }>;
  createdAt: string;
  updatedAt: string;
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

// Base product form schema
const baseProductSchema = z.object({
  displayName: z.string().optional(),
  baseIngredients: z.any().optional(),
});

type CustomDataFormData = z.infer<typeof customDataSchema>;
type BaseProductFormData = z.infer<typeof baseProductSchema>;

export function ProductsTab() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ShopifyProduct>('productTitle');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [isSetRuleModalOpen, setIsSetRuleModalOpen] = useState(false);
  const [isManageRulesModalOpen, setIsManageRulesModalOpen] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  // Inline base product editing state for display names
  const [baseEdits, setBaseEdits] = useState<Record<string, { displayName?: string }>>({});
  const [isSavingAllBase, setIsSavingAllBase] = useState(false);
  const [saveAllBaseProgress, setSaveAllBaseProgress] = useState<{done:number; total:number}>({done:0,total:0});
  // Inline variant display name editing state
  const [variantEdits, setVariantEdits] = useState<Record<string, { displayName?: string }>>({});
  const [savingVariant, setSavingVariant] = useState<Record<string, boolean>>({});
  
  // Base product editing
  const [isBaseProductDialogOpen, setIsBaseProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopifyProduct | null>(null);
  
  // Inline ingredient management per product
  const [expandedIngredientsFor, setExpandedIngredientsFor] = useState<Set<string>>(new Set());
  const [ingredientSearch, setIngredientSearch] = useState<Record<string, string>>({});
  const [ingredientQty, setIngredientQty] = useState<Record<string, number>>({});
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});
  const [isSavingIngredient, setIsSavingIngredient] = useState<Record<string, boolean>>({});
  const [componentsCatalog, setComponentsCatalog] = useState<any[]>([]);
  const [otherCatalog, setOtherCatalog] = useState<any[]>([]);
  const [gilmoursCatalog, setGilmoursCatalog] = useState<any[]>([]);
  const [bidfoodCatalog, setBidfoodCatalog] = useState<any[]>([]);
  // Bundle product search (reuses products search endpoint)
  const [bundleSearch, setBundleSearch] = useState<Record<string, string>>({});
  const [bundleResults, setBundleResults] = useState<Record<string, any[]>>({});
  const [bundleQty, setBundleQty] = useState<Record<string, number>>({});
  const [savingBundleFor, setSavingBundleFor] = useState<string | null>(null);

  // Memoize the filtered and sorted products to prevent unnecessary re-renders
  const filteredAndSortedProducts = useMemo((): ShopifyProduct[] => {
    // Ensure products is always an array
    const productsArray = Array.isArray(products) ? products : [];
    let filtered = productsArray;
    
    if (searchTerm) {
      filtered = productsArray.filter(product => {
        // Validate product structure
        if (!product || typeof product !== 'object') return false;
        
        // Search in product-level fields
        if (
          (product.productTitle && product.productTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (product.displayName && product.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
        ) {
          return true;
        }
        // Search in variant-level fields - ensure variants exists and is an array
        if (product.variants && Array.isArray(product.variants)) {
          return product.variants.some(variant => {
            if (!variant || typeof variant !== 'object') return false;
            return (
              (variant.shopifyName && variant.shopifyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (variant.shopifyTitle && variant.shopifyTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (variant.displayName && variant.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
            );
          });
        }
        return false;
      });
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField as keyof ShopifyProduct];
      const bValue = b[sortField as keyof ShopifyProduct];
      
      // Handle undefined/null values
      if (aValue === undefined || aValue === null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === undefined || bValue === null) return sortDirection === 'asc' ? -1 : 1;
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, searchTerm, sortField, sortDirection]);

  // Debounced search handler
  const debouncedSetSearchTerm = useCallback(
    (value: string) => {
      const timeoutId = setTimeout(() => {
        setSearchTerm(value);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
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

  const baseProductForm = useForm<BaseProductFormData>({
    resolver: zodResolver(baseProductSchema),
    defaultValues: {
      displayName: '',
      baseIngredients: [],
    },
  });

  // Load ingredient catalogs for search
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [cRes, oRes, gRes, bRes] = await Promise.all([
          fetch('/api/components'),
          fetch('/api/other'),
          fetch('/api/gilmours'),
          fetch('/api/bidfood')
        ]);
        
        if (cRes.ok) {
          const data = await cRes.json();
          setComponentsCatalog(Array.isArray(data) ? data : (data.components || []));
        }
        if (oRes.ok) {
          const data = await oRes.json();
          setOtherCatalog(Array.isArray(data) ? data : (data.products || []));
        }
        if (gRes.ok) {
          const data = await gRes.json();
          setGilmoursCatalog(Array.isArray(data) ? data : (data.products || []));
        }
        if (bRes.ok) {
          const data = await bRes.json();
          setBidfoodCatalog(Array.isArray(data) ? data : (data.products || []));
        }
      } catch (error) {
        console.error('Error loading catalogs:', error);
      }
    };
    loadCatalogs();
  }, []);

  // Fetch products function
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const productsData = await response.json();
        
        // Keep the new grouped structure (products with variants)
        if (Array.isArray(productsData)) {
          setProducts(productsData);
        } else {
          setProducts([]);
        }
      } else {
        const text = await response.text();
        console.error('Failed to fetch products:', response.status, response.statusText, text);
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

  // CSV Export function
  const exportToCSV = useCallback(() => {
    try {
      // Get all products (not just filtered ones)
      const productsToExport = Array.isArray(products) ? products : [];
      
      if (productsToExport.length === 0) {
        alert('No products to export');
        return;
      }

      // Define CSV headers
      const headers = [
        'ID',
        'Variant ID',
        'Created At',
        'Updated At',
        'Shopify Product ID',
        'Shopify SKU',
        'Shopify Name',
        'Shopify Title',
        'Shopify Price',
        'Shopify Inventory',
        'Display Name',
        'Meat 1',
        'Meat 2',
        'Timer 1',
        'Timer 2',
        'Option 1',
        'Option 2',
        'Serveware',
        'Is Draft',
        'Legacy Name',
        'Description',
        'Variant SKU',
        'Timer A',
        'Timer B',
        'Ingredients (JSON)',
        'Total Cost'
      ];

      // Convert products to CSV rows - flatten variants
      const csvRows: any[] = [];
      productsToExport.forEach(product => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        variants.forEach(variant => {
          csvRows.push([
            variant.id || '',
            variant.variantId || '',
            variant.createdAt || '',
            variant.updatedAt || '',
            product.shopifyProductId || '',
            variant.shopifySku || '',
            variant.shopifyName || '',
            variant.shopifyTitle || '',
            variant.shopifyPrice || '',
            variant.shopifyInventory || '',
            variant.displayName || '',
            variant.meat1 || '',
            variant.meat2 || '',
            variant.timer1 || '',
            variant.timer2 || '',
            variant.option1 || '',
            variant.option2 || '',
            variant.serveware ? 'Yes' : 'No',
            variant.isDraft ? 'Yes' : 'No',
            '', // Legacy name
            '', // Description
            variant.shopifySku || '', // Variant SKU
            '', // Timer A
            '', // Timer B
            variant.ingredients ? JSON.stringify(variant.ingredients) : '',
            variant.totalCost || ''
          ]);
        });
      });

      // Escape CSV values (handle commas, quotes, newlines)
      const escapeCSVValue = (value: string | number) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Create CSV content
      const csvContent = [
        headers.map(escapeCSVValue).join(','),
        ...csvRows.map(row => row.map(escapeCSVValue).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `products-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Exported ${csvRows.length} variants from ${productsToExport.length} products to CSV`);
    } catch (error) {
      console.error('❌ Error exporting to CSV:', error);
      alert('Failed to export products to CSV. Check console for details.');
    }
  }, [products]);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSort = useCallback((key: string) => {
    setSortField(key as keyof ShopifyProduct);
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  // Inline edit for product display name
  const handleInlineEditBase = useCallback((productId: string, value: string) => {
    setBaseEdits(prev => ({ ...prev, [productId]: { displayName: value } }));
  }, []);

  const handleSaveAllBase = useCallback(async () => {
    const entries = Object.entries(baseEdits).filter(([,v]) => v && 'displayName' in v);
    if (entries.length === 0) return;
    setIsSavingAllBase(true);
    setSaveAllBaseProgress({done:0,total:entries.length});
    const delay = (ms:number)=>new Promise(res=>setTimeout(res, ms));
    for (let i=0;i<entries.length;i++){
      const [productId, changes] = entries[i];
      try {
        const res = await fetch(`/api/products/${productId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: (changes.displayName ?? '').trim() })
        });
        if (!res.ok) {
          console.error('Failed to save base display name for', productId, await res.text());
        }
      } catch(e) { console.error('Error saving base display name', productId, e); }
      setSaveAllBaseProgress({done:i+1,total:entries.length});
      await delay(120); // gentle rate limit
    }
    await fetchProducts();
    setIsSavingAllBase(false);
  }, [baseEdits, fetchProducts]);

  // Inline edit for variant display name
  const handleInlineEditVariant = useCallback((variantId: string, value: string) => {
    setVariantEdits(prev => ({ ...prev, [variantId]: { displayName: value } }));
  }, []);

  // Save variant display name
  const handleSaveVariantDisplayName = useCallback(async (variantId: string) => {
    const edit = variantEdits[variantId];
    if (!edit || edit.displayName === undefined) return;
    
    setSavingVariant(prev => ({ ...prev, [variantId]: true }));
    try {
      const res = await fetch(`/api/products/variant/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: (edit.displayName ?? '').trim() })
      });
      if (!res.ok) {
        console.error('Failed to save variant display name for', variantId, await res.text());
        alert('Failed to save display name');
      } else {
        // Clear the edit after successful save
        setVariantEdits(prev => {
          const next = { ...prev };
          delete next[variantId];
          return next;
        });
        await fetchProducts();
      }
    } catch (e) {
      console.error('Error saving variant display name', variantId, e);
      alert('Error saving display name');
    } finally {
      setSavingVariant(prev => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    }
  }, [variantEdits, fetchProducts]);

  const toggleProductExpanded = useCallback((productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const handleEdit = useCallback((variant: ProductVariant) => {
    setEditingVariant(variant);
    
    // Pre-fill form with existing data
    const formData = {
      displayName: variant.displayName || '',
      meat1: variant.meat1 || '',
      meat2: variant.meat2 || '',
      timer1: variant.timer1 || null,
      timer2: variant.timer2 || null,
      option1: variant.option1 || '',
      option2: variant.option2 || '',
      serveware: variant.serveware || false,
      ingredients: variant.ingredients || [],
      totalCost: variant.totalCost ? parseFloat((variant.totalCost as number).toFixed(2)) : 0,
    };

    form.reset(formData);
    setIsDialogOpen(true);
  }, [form]);

  const handleSaveProduct = useCallback(async (data: CustomDataFormData) => {
    if (!editingVariant) return;

    try {
      // Include displayName to allow variant-level overrides
      const response = await fetch('/api/products/variant/' + editingVariant.variantId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('✅ Variant saved successfully, refreshing data...');
        
        // Refresh the products data from the server to ensure we have the latest data
        await fetchProducts();
        
        setIsDialogOpen(false);
        setEditingVariant(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to save variant:', errorData);
        alert(`Failed to save variant: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving variant:', error);
      alert('Error saving variant. Please try again.');
    }
  }, [editingVariant, fetchProducts]);

  const handleEditBaseProduct = useCallback((product: ShopifyProduct) => {
    setEditingProduct(product);
    
    // Pre-fill form with existing data
    const formData = {
      displayName: product.displayName || '',
      baseIngredients: product.baseIngredients || [],
    };

    baseProductForm.reset(formData);
    setIsBaseProductDialogOpen(true);
  }, [baseProductForm]);

  const handleSaveBaseProduct = useCallback(async (data: BaseProductFormData) => {
    if (!editingProduct) return;

    try {
      const response = await fetch('/api/products/' + editingProduct.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('✅ Base product saved successfully, refreshing data...');
        
        // Refresh the products data from the server to ensure we have the latest data
        await fetchProducts();
        
        setIsBaseProductDialogOpen(false);
        setEditingProduct(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to save base product:', errorData);
        alert(`Failed to save base product: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving base product:', error);
      alert('Error saving base product. Please try again.');
    }
  }, [editingProduct, fetchProducts]);

  // Toggle ingredient expansion for a product
  const toggleIngredientsExpanded = useCallback((productId: string) => {
    setExpandedIngredientsFor(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  // Search variants to add to bundle (by product title/name/sku)
  const handleBundleSearch = useCallback(async (productId: string, term: string) => {
    setBundleSearch(prev => ({ ...prev, [productId]: term }))
    if (!term.trim()) {
      setBundleResults(prev => ({ ...prev, [productId]: [] }))
      return
    }
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&group=1&limitProducts=50&limitVariantsPerProduct=999`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setBundleResults(prev => ({ ...prev, [productId]: list }))
    } catch (e) {
      console.error('Bundle search failed', e)
      setBundleResults(prev => ({ ...prev, [productId]: [] }))
    }
  }, [])

  // Add selected variant to product-level bundle defaults
  const handleAddBundleItemToProduct = useCallback(async (productId: string, variant: any) => {
    setSavingBundleFor(productId)
    try {
      const product = products.find(p => p.id === productId)
      if (!product) return
      const qty = bundleQty[productId] || 1
      const current = Array.isArray(product.bundleDefaultItems) ? product.bundleDefaultItems : []
      const updated = [...current, { variantId: String(variant.variantId), quantity: Math.max(1, qty) }]
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPartyPackDefault: true, bundleDefaultItems: updated })
      })
      if (res.ok) {
        await fetchProducts()
        setBundleSearch(prev => ({ ...prev, [productId]: '' }))
        setBundleResults(prev => ({ ...prev, [productId]: [] }))
        setBundleQty(prev => ({ ...prev, [productId]: 1 }))
      } else {
        console.error('Failed to add bundle item to product', await res.text())
        alert('Failed to add product to bundle')
      }
    } catch (e) {
      console.error('Error adding bundle item to product', e)
      alert('Error adding product to bundle')
    } finally {
      setSavingBundleFor(null)
    }
  }, [products, bundleQty, fetchProducts])

  const handleRemoveBundleItemFromProduct = useCallback(async (productId: string, index: number) => {
    setSavingBundleFor(productId)
    try {
      const product = products.find(p => p.id === productId)
      if (!product) return
      const current = Array.isArray(product.bundleDefaultItems) ? product.bundleDefaultItems : []
      const updated = current.filter((_, i) => i !== index)
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundleDefaultItems: updated, isPartyPackDefault: updated.length > 0 })
      })
      if (res.ok) {
        await fetchProducts()
      } else {
        console.error('Failed to remove bundle item', await res.text())
        alert('Failed to remove product from bundle')
      }
    } catch (e) {
      console.error('Error removing bundle item', e)
    } finally {
      setSavingBundleFor(null)
    }
  }, [products, fetchProducts])

  // Search ingredients for a specific product
  const handleIngredientSearch = useCallback((productId: string, term: string) => {
    setIngredientSearch(prev => ({ ...prev, [productId]: term }));
    
    if (!term.trim()) {
      setSearchResults(prev => ({ ...prev, [productId]: [] }));
      return;
    }

    setIsSearching(prev => ({ ...prev, [productId]: true }));
    
    const q = term.toLowerCase();
    const results: any[] = [];

    // Search Components (priority)
    if (Array.isArray(componentsCatalog)) {
      componentsCatalog.forEach(c => {
        if (c && typeof c === 'object' && ((c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))) {
          results.push({ ...c, source: 'Components', _priority: 1 });
        }
      });
    }

    // Search Other
    if (Array.isArray(otherCatalog)) {
      otherCatalog.forEach(o => {
        if (o && typeof o === 'object' && ((o.name || '').toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q))) {
          results.push({ ...o, source: 'Other', _priority: 2 });
        }
      });
    }

    // Search Gilmours
    if (Array.isArray(gilmoursCatalog)) {
      gilmoursCatalog.forEach(g => {
        if (g && typeof g === 'object' && ((g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q))) {
          results.push({ ...g, source: 'Gilmours', _priority: 3 });
        }
      });
    }

    // Search Bidfood
    if (Array.isArray(bidfoodCatalog)) {
      bidfoodCatalog.forEach(b => {
        if (b && typeof b === 'object' && ((b.name || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q))) {
          results.push({ ...b, source: 'Bidfood', _priority: 4 });
        }
      });
    }

    // Sort by priority (Components first), then by name
    results.sort((a, b) => {
      if (a._priority !== b._priority) return a._priority - b._priority;
      return (a.name || '').localeCompare(b.name || '');
    });

    setSearchResults(prev => ({ ...prev, [productId]: results.slice(0, 10) }));
    setIsSearching(prev => ({ ...prev, [productId]: false }));
  }, [componentsCatalog, otherCatalog, gilmoursCatalog, bidfoodCatalog]);

  // Add ingredient to product's baseIngredients
  const handleAddIngredient = useCallback(async (productId: string, item: any) => {
    setIsSavingIngredient(prev => ({ ...prev, [productId]: true }));
    
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const qty = ingredientQty[productId] || 1;
      const currentBase = Array.isArray(product.baseIngredients) ? product.baseIngredients : [];
      
      const newIngredient = {
        source: item.source,
        id: item.id,
        name: item.name || item.description || 'Unknown Item',
        quantity: qty,
        cost: item.source === 'Components'
          ? (item.costPerOutputUnit ?? item.totalCost ?? 0)
          : (item.source === 'Products'
              ? (item.cost !== undefined ? item.cost : 0)
              : (item.price ?? item.cost ?? item.lastPricePaid ?? 0)),
        unit: item.normalizedOutputUnit || item.uom || 'unit',
      };

      const updatedBase = [...currentBase, newIngredient];

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseIngredients: updatedBase })
      });

      if (response.ok) {
        await fetchProducts();
        setIngredientSearch(prev => ({ ...prev, [productId]: '' }));
        setSearchResults(prev => ({ ...prev, [productId]: [] }));
        setIngredientQty(prev => ({ ...prev, [productId]: 1 }));
      } else {
        console.error('Failed to add ingredient');
        alert('Failed to add ingredient');
      }
    } catch (error) {
      console.error('Error adding ingredient:', error);
      alert('Error adding ingredient');
    } finally {
      setIsSavingIngredient(prev => ({ ...prev, [productId]: false }));
    }
  }, [products, ingredientQty, fetchProducts]);

  // Remove ingredient from product's baseIngredients
  const handleRemoveIngredient = useCallback(async (productId: string, index: number) => {
    setIsSavingIngredient(prev => ({ ...prev, [productId]: true }));
    
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const currentBase = Array.isArray(product.baseIngredients) ? product.baseIngredients : [];
      const updatedBase = currentBase.filter((_, i) => i !== index);

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseIngredients: updatedBase })
      });

      if (response.ok) {
        await fetchProducts();
      } else {
        console.error('Failed to remove ingredient');
        alert('Failed to remove ingredient');
      }
    } catch (error) {
      console.error('Error removing ingredient:', error);
      alert('Error removing ingredient');
    } finally {
      setIsSavingIngredient(prev => ({ ...prev, [productId]: false }));
    }
  }, [products, fetchProducts]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading products...</div>;
  }

  const safeProducts: ShopifyProduct[] = Array.isArray(filteredAndSortedProducts) ? filteredAndSortedProducts : [];
  
  // Debug logging
  console.log('ProductsTab render - products:', products, 'filteredAndSortedProducts:', filteredAndSortedProducts, 'safeProducts:', safeProducts);

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
          <Button 
            onClick={exportToCSV}
            variant="outline"
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
          {Object.keys(baseEdits).length > 0 && (
            <Button
              onClick={handleSaveAllBase}
              disabled={isSavingAllBase}
              className="flex items-center gap-2"
              title="Save all product display names"
            >
              {isSavingAllBase ? `Saving ${saveAllBaseProgress.done}/${saveAllBaseProgress.total}` : `Save All Display Names (${Object.keys(baseEdits).length})`}
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('productTitle')}
                  className="flex items-center gap-1"
                >
                  Product Name
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
            </TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Bakery</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price (ex GST)</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Margin %</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {(() => {
              try {
                const productsArray = Array.isArray(safeProducts) ? safeProducts : [];
                return productsArray.map((product: ShopifyProduct) => {
                  const isExpanded = expandedProducts.has(product.id);
                  const variants = Array.isArray(product.variants) ? product.variants : [];

                  return (
                    <React.Fragment key={product.id}>
                      {/* Product Row */}
                      <TableRow className="bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProductExpanded(product.id);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <div>
                              <div className="font-medium">{product.productTitle}</div>
                              {product.displayName && (
                                <div className="text-sm text-blue-600">{product.displayName}</div>
                              )}
                              <div className="text-sm text-gray-500">
                                {variants.length} variant{variants.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={baseEdits[product.id]?.displayName ?? product.displayName ?? ''}
                            onChange={(e)=>handleInlineEditBase(product.id, e.target.value)}
                            placeholder="Display name"
                          />
                        </TableCell>
                        <TableCell>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={product.bakery || false}
                              onChange={async (e) => {
                                try {
                                  const response = await fetch(`/api/products/${product.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ bakery: e.target.checked })
                                  });
                                  if (response.ok) {
                                    await fetchProducts();
                                  } else {
                                    alert('Failed to update bakery flag');
                                  }
                                } catch (error) {
                                  console.error('Error updating bakery flag:', error);
                                  alert('Error updating bakery flag');
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span>Bakery</span>
                          </label>
                        </TableCell>
                        <TableCell colSpan={4} className="text-gray-500">
                          Product Group
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleIngredientsExpanded(product.id);
                              }}
                              title="Manage base ingredients"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditBaseProduct(product);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Base Ingredients Manager Row */}
                      {expandedIngredientsFor.has(product.id) && (
                        <TableRow className="bg-blue-50">
                          <TableCell colSpan={8} className="p-4">
                            <div className="space-y-3">
                              <div className="font-semibold text-sm">Base Ingredients (apply to all variants)</div>
                              
                              {/* Current Base Ingredients List */}
                              <div className="space-y-2">
                                {Array.isArray(product.baseIngredients) && product.baseIngredients.length > 0 ? (
                                  product.baseIngredients.map((ing: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border">
                                      <span className="flex-1 text-sm">
                                        <strong>{ing.name}</strong> - {ing.quantity} {ing.unit} @ ${typeof ing.cost === 'number' ? ing.cost.toFixed(2) : '0.00'} ({ing.source})
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveIngredient(product.id, idx)}
                                        disabled={isSavingIngredient[product.id]}
                                        className="h-6 w-6 p-0"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-gray-500">No base ingredients yet</div>
                                )}
                              </div>

                              {/* Search and Add Interface */}
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs">Search Ingredients</Label>
                                  <Input
                                    value={ingredientSearch[product.id] || ''}
                                    onChange={(e) => handleIngredientSearch(product.id, e.target.value)}
                                    placeholder="Search components, products, suppliers..."
                                    className="h-9"
                                  />
                                </div>
                                <div className="w-24">
                                  <Label className="text-xs">Qty</Label>
                                  <Input
                                    type="number"
                                    value={ingredientQty[product.id] || 1}
                                    onChange={(e) => setIngredientQty(prev => ({ ...prev, [product.id]: Number(e.target.value) || 1 }))}
                                    className="h-9"
                                    min="0.01"
                                    step="0.01"
                                  />
                                </div>
                              </div>

                              {/* Search Results */}
                              {searchResults[product.id] && searchResults[product.id].length > 0 && (
                                <div className="border rounded bg-white max-h-48 overflow-y-auto">
                                  {searchResults[product.id].map((result: any) => (
                                    <div
                                      key={`${result.source}-${result.id}`}
                                      className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0"
                                    >
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{result.name}</div>
                                        <div className="text-xs text-gray-500">{result.source}</div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAddIngredient(product.id, result)}
                                        disabled={isSavingIngredient[product.id]}
                                        className="h-7"
                                      >
                                        {isSavingIngredient[product.id] ? '...' : <Plus className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Bundle Products (Party Pack) */}
                              <div className="pt-4 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">Bundle Products (Party Pack)</Label>
                                  {Array.isArray(product.bundleDefaultItems) && product.bundleDefaultItems.length > 0 && (
                                    <Badge className="ml-2" variant="secondary">{product.bundleDefaultItems.length} items</Badge>
                                  )}
                                </div>
                                {/* Existing bundle list */}
                                <div className="space-y-2">
                                  {Array.isArray(product.bundleDefaultItems) && product.bundleDefaultItems.length > 0 ? (
                                    product.bundleDefaultItems.map((b, idx) => (
                                      <div key={`${b.variantId}-${idx}`} className="flex items-center gap-2 bg-white p-2 rounded border">
                                        <span className="flex-1 text-sm"><strong>Variant</strong>: {b.variantId} &nbsp; <strong>Qty</strong>: {b.quantity}</span>
                                        <Button size="sm" variant="ghost" onClick={() => handleRemoveBundleItemFromProduct(product.id, idx)} disabled={savingBundleFor===product.id} className="h-6 w-6 p-0"><X className="h-3 w-3"/></Button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-500">No bundle items yet</div>
                                  )}
                                </div>
                                {/* Search to add variants */}
                                <div className="flex items-end gap-2">
                                  <div className="flex-1">
                                    <Label className="text-xs">Search Products/Variants</Label>
                                    <Input
                                      value={bundleSearch[product.id] || ''}
                                      onChange={(e) => handleBundleSearch(product.id, e.target.value)}
                                      placeholder="Search by product name or SKU..."
                                      className="h-9"
                                    />
                                  </div>
                                  <div className="w-24">
                                    <Label className="text-xs">Qty</Label>
                                    <Input
                                      type="number"
                                      value={bundleQty[product.id] || 1}
                                      onChange={(e) => setBundleQty(prev => ({ ...prev, [product.id]: Number(e.target.value) || 1 }))}
                                      className="h-9"
                                      min="1"
                                      step="1"
                                    />
                                  </div>
                                </div>
                                {bundleResults[product.id] && bundleResults[product.id].length > 0 && (
                                  <div className="border rounded bg-white max-h-64 overflow-y-auto divide-y">
                                    {bundleResults[product.id].map((grp: any) => (
                                      <div key={grp.product.id} className="p-2">
                                        <div className="text-sm font-semibold">{grp.product.productTitle || grp.product.displayName}</div>
                                        <div className="mt-1 space-y-1">
                                          {grp.variants.map((v: any) => (
                                            <div key={v.variantId} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                                              <div className="flex-1">
                                                <div className="text-xs">{v.shopifyName && v.shopifyName !== 'Default Title' ? v.shopifyName : v.shopifyTitle}</div>
                                                <div className="text-[10px] text-gray-500">SKU: {v.shopifySku || v.variantSku} • Variant ID: {v.variantId}</div>
                                              </div>
                                              <Button size="sm" onClick={() => handleAddBundleItemToProduct(product.id, v)} disabled={savingBundleFor===product.id} className="h-6 px-2 py-0">{savingBundleFor===product.id ? '...' : <Plus className="h-3 w-3"/>}</Button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Variant Rows */}
                      {isExpanded && variants.map((variant) => (
                        <TableRow key={variant.variantId} className="cursor-pointer hover:bg-gray-50" onClick={() => handleEdit(variant)}>
                          <TableCell className="pl-8">
                            <div>
                              <div className="font-medium text-sm">{variant.shopifyName}</div>
                              {variant.displayName && variant.displayName !== variant.shopifyName && (
                                <div className="text-xs text-blue-600">{variant.displayName}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={variantEdits[variant.variantId]?.displayName ?? variant.displayName ?? ''}
                              onChange={(e) => handleInlineEditVariant(variant.variantId, e.target.value)}
                              onBlur={() => handleSaveVariantDisplayName(variant.variantId)}
                              placeholder="Display name"
                              disabled={savingVariant[variant.variantId]}
                              className="h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell />
                          <TableCell>
                            <div className="text-sm">{variant.shopifyName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{variant.shopifySku}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">${(Number(variant.shopifyPrice) / 1.15).toFixed(2)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">${(variant.totalCost || 0).toFixed(2)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(() => {
                                const priceEx = Number(variant.shopifyPrice) / 1.15
                                const cost = Number(variant.totalCost || 0)
                                if (!isFinite(priceEx) || priceEx <= 0) return '0.0'
                                const m = ((priceEx - cost) / priceEx) * 100
                                return m.toFixed(1)
                              })()}%
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(variant);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                });
              } catch (error) {
                console.error('Error rendering ProductsTab:', error);
                return (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-red-500">
                      Error rendering products. Please try refreshing the page.
                    </TableCell>
                  </TableRow>
                );
              }
            })()}
        </TableBody>
      </Table>
      </div>

      {/* Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product Variant</DialogTitle>
            <DialogDescription>
              {editingVariant ? (
                <div className="space-y-2">
                  <div><strong>Shopify Product:</strong> {editingVariant.shopifyTitle}</div>
                  <div><strong>Variant:</strong> {editingVariant.shopifyName}</div>
                  <div><strong>SKU:</strong> {editingVariant.shopifySku}</div>
                  <div><strong>Price:</strong> ${editingVariant.shopifyPrice}</div>
                  {editingVariant.option1 && <div><strong>Option 1:</strong> {editingVariant.option1}</div>}
                  {editingVariant.option2 && <div><strong>Option 2:</strong> {editingVariant.option2}</div>}
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSaveProduct)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="displayName">Display Name (optional)</Label>
                <Input
                  id="displayName"
                  {...form.register('displayName')}
                  placeholder="Override parent product variant display name"
                />
                <p className="text-xs text-gray-500">This will override the parent product variant display name</p>
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
                  // Calculate total cost from ingredients - ensure ingredients is an array
                  const ingredientsArray = Array.isArray(ingredients) ? ingredients : [];
                  const totalCost = ingredientsArray.reduce((sum, ingredient) => {
                    if (!ingredient || typeof ingredient !== 'object') return sum;
                    const cost = typeof ingredient.cost === 'number' ? ingredient.cost : 0;
                    const quantity = typeof ingredient.quantity === 'number' ? ingredient.quantity : 0;
                    return sum + (cost * quantity);
                  }, 0);
                  // Round to 2dp for display and saving
                  form.setValue('totalCost', parseFloat(totalCost.toFixed(2)));
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

      {/* Edit Base Product Modal */}
      <Dialog open={isBaseProductDialogOpen} onOpenChange={setIsBaseProductDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Base Product</DialogTitle>
            <DialogDescription>
              {editingProduct ? (
                <div className="space-y-2">
                  <div><strong>Product:</strong> {editingProduct.productTitle}</div>
                  <div><strong>Product ID:</strong> {editingProduct.shopifyProductId}</div>
                  <div><strong>Variants:</strong> {editingProduct.variants?.length || 0}</div>
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={baseProductForm.handleSubmit(handleSaveBaseProduct)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseDisplayName">Display Name</Label>
                <Input
                  id="baseDisplayName"
                  {...baseProductForm.register('displayName')}
                  placeholder="Custom display name for this product"
                />
              </div>

              <div className="space-y-2">
                <Label>Base Components</Label>
                <p className="text-sm text-gray-600">
                  These components will be applied to all variants of this product.
                </p>
                <IngredientSelector
                  onIngredientsChange={(ingredients) => {
                    baseProductForm.setValue('baseIngredients', ingredients);
                  }}
                  initialIngredients={baseProductForm.watch('baseIngredients') || []}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBaseProductDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Base Product</Button>
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