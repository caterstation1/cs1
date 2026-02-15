import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Settings, Save, CheckSquare, Square } from 'lucide-react';
import { IngredientSelector } from './IngredientSelector';

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
  createdAt: string;
  updatedAt: string;
}

type VariantOptionFormData = {
  optionName: string;
  meat?: string;
  timer?: number | null;
  option?: string;
  serveware?: boolean;
};

interface VariantPartRow {
  partName: string;
  variants: (ProductVariant & { productTitle: string; productId: string })[];
}

export function VariantsTab() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<any[]>([]);
  const [lastComponentsByPart, setLastComponentsByPart] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  // Admin verify & fix modal
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyPartName, setVerifyPartName] = useState('');
  const [verifyMeat, setVerifyMeat] = useState('');
  const [verifyTimer, setVerifyTimer] = useState<string>('');
  const [verifyOption, setVerifyOption] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  // Cleanup options indices
  const [isCleanOpen, setIsCleanOpen] = useState(false);
  const [cleanResult, setCleanResult] = useState<any | null>(null);
  // Bulk verify all
  const [isVerifyAllOpen, setIsVerifyAllOpen] = useState(false);
  const [verifyAllResult, setVerifyAllResult] = useState<any | null>(null);
  // Serveware migration
  const [isMigratingServeware, setIsMigratingServeware] = useState(false);
  const [servewareMigrationResult, setServewareMigrationResult] = useState<any | null>(null);
  
  // Inline editing state for the table (keyed by full variant title)
  const [editingData, setEditingData] = useState<{ [variantTitle: string]: VariantOptionFormData }>({});


  // Build unique rows by individual parts parsed from variant titles
  const variantPartRows = useMemo(() => {
    const map = new Map<string, VariantPartRow>();
    // Ensure products is an array before iterating
    const productsArray = Array.isArray(products) ? products : [];

    productsArray.forEach(product => {
      if (!product || typeof product !== 'object') return;
      if (!Array.isArray(product.variants)) return;
      product.variants.forEach(variant => {
        if (!variant || typeof variant !== 'object') return;
        const title = (variant.shopifyName || variant.shopifyTitle || '').trim();
        if (!title) return;
        const parts = title.split(' / ').map(p => p.trim()).filter(Boolean);
        parts.forEach(part => {
          if (!map.has(part)) {
            map.set(part, { partName: part, variants: [] });
          }
          const row = map.get(part)!;
          row.variants.push({ ...variant, productTitle: product.productTitle, productId: product.id });
        });
      });
    });

    return Array.from(map.values()).sort((a, b) => a.partName.localeCompare(b.partName));
  }, [products]);

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return variantPartRows;
    const q = searchTerm.toLowerCase();
    return variantPartRows.filter(row =>
      row.partName.toLowerCase().includes(q) ||
      row.variants.some(v => v.productTitle.toLowerCase().includes(q) || (v.shopifySku || '').toLowerCase().includes(q))
    );
  }, [variantPartRows, searchTerm]);

  // Compute aggregated persisted values for a part across all variants
  const computePartAggregates = useCallback((partName: string) => {
    const meats: Array<string | null | undefined> = [];
    const timers: Array<number | null | undefined> = [];
    const options: Array<string | null | undefined> = [];
    const servewares: Array<boolean> = [];
    // Ensure products is an array before iterating
    const productsArray = Array.isArray(products) ? products : [];
    productsArray.forEach(product => {
      if (!product || typeof product !== 'object') return;
      if (!Array.isArray(product.variants)) return;
      product.variants.forEach(variant => {
        if (!variant || typeof variant !== 'object') return;
        const title = (variant.shopifyName || variant.shopifyTitle || '').trim();
        const parts = title.split(' / ').map(p => p.trim());
        const idx = parts.indexOf(partName);
        if (idx >= 0) {
          const vAny = variant as any;
          const mArr = Array.isArray(vAny.meats) ? vAny.meats as (string | null)[] : [variant.meat1 ?? null, variant.meat2 ?? null];
          const tArr = Array.isArray(vAny.timers) ? vAny.timers as (number | null)[] : [variant.timer1 ?? null, variant.timer2 ?? null];
          const oArr = Array.isArray(vAny.options) ? vAny.options as (string | null)[] : [variant.option1 ?? null, variant.option2 ?? null];
          meats.push(mArr[idx]);
          timers.push(tArr[idx]);
          options.push(oArr[idx]);
          servewares.push(variant.serveware || false);
        }
      });
    });
    const consensus = <T,>(arr: (T | null | undefined)[]): T | undefined => {
      const vals = arr.filter(v => v !== undefined && v !== null && (v as any) !== '') as T[];
      if (vals.length === 0) return undefined;
      return vals.every(v => v === vals[0]) ? vals[0] : undefined;
    };
    const servewareConsensus = servewares.length > 0 && servewares.every(s => s === servewares[0]) ? servewares[0] : undefined;
    return {
      meat: consensus<string>(meats),
      timer: consensus<number>(timers),
      option: consensus<string>(options),
      serveware: servewareConsensus
    };
  }, [products]);

  // Aggregate unique component names for a given part across all variants
  const computePartComponents = useCallback((partName: string) => {
    const names = new Set<string>();
    // Ensure products is an array before iterating
    const productsArray = Array.isArray(products) ? products : [];
    productsArray.forEach(product => {
      if (!product || typeof product !== 'object') return;
      if (!Array.isArray(product.variants)) return;
      product.variants.forEach(variant => {
        if (!variant || typeof variant !== 'object') return;
        const title = (variant.shopifyName || variant.shopifyTitle || '').trim();
        const parts = title.split(' / ').map(p => p.trim());
        if (!parts.includes(partName)) return;
        const ingr = (variant as any).ingredients as any[] | undefined;
        if (Array.isArray(ingr)) {
          ingr.forEach(i => {
            if (!i || typeof i !== 'object') return;
            const n = i?.name || i?.id || i?.source;
            if (n) names.add(n);
          });
        }
      });
    });
    return Array.from(names).sort();
  }, [products]);

  // Fetch products function
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const productsData = await response.json();
        
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

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle inline editing - update local state
  const handleInlineEdit = useCallback((variantTitle: string, field: string, value: any) => {
    setEditingData(prev => ({
      ...prev,
      [variantTitle]: {
        ...prev[variantTitle],
        optionName: variantTitle,
        [field]: value
      }
    }));
  }, []);

  // Save all changes for an option
  const handleSaveOptionInline = useCallback(async (partName: string) => {
    const optionData = editingData[partName];
    if (!optionData) return;

    try {
      // Server-side bulk update for this part
      const payload: any = { partName };
      if (optionData.meat !== undefined) payload.meat = optionData.meat;
      if (optionData.timer !== undefined) payload.timer = optionData.timer;
      if (optionData.option !== undefined) payload.option = optionData.option;
      if (optionData.serveware !== undefined) payload.serveware = optionData.serveware;
      const res = await fetch('/api/variants/bulk-part-save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        console.error('Bulk save failed for part', partName, await res.text());
      } else {
        const result = await res.json();
        console.log(`✅ Bulk updated variants for part "${partName}":`, result);
      }
      
      // Refresh data
      await fetchProducts();
      // Persist the edited values in the inputs so users see what's stored
      setEditingData(prev => ({
        ...prev,
        [partName]: {
          optionName: partName,
          meat: optionData.meat ?? (prev[partName]?.meat),
          timer: optionData.timer ?? (prev[partName]?.timer ?? null),
          option: optionData.option ?? (prev[partName]?.option),
          serveware: optionData.serveware ?? (prev[partName]?.serveware)
        }
      }));
    } catch (error) {
      console.error('Error updating variant option:', error);
      alert('Error updating variant option. Please try again.');
    }
  }, [editingData, products, fetchProducts]);


  const handleAddComponentsToOption = useCallback(async (partName: string) => {
    if (selectedComponents.length === 0) return;

    try {
      // Find all variants that contain this part
      const relevantVariants: ProductVariant[] = [];
      products.forEach(product => {
        if (Array.isArray(product.variants)) {
          product.variants.forEach(variant => {
            const title = (variant.shopifyName || variant.shopifyTitle || '').trim();
            const parts = title.split(' / ').map(p => p.trim());
            if (parts.includes(partName)) relevantVariants.push(variant);
          });
        }
      });

      const updates = relevantVariants.map(async (variant) => {
        // First get current ingredients
        const response = await fetch(`/api/products/variant/${variant.variantId}`);
        const variantData = await response.json();
        
        const currentIngredients = variantData.ingredients || [];
        const updatedIngredients = [...currentIngredients, ...selectedComponents];

        const updateResponse = await fetch(`/api/products/variant/${variant.variantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredients: updatedIngredients })
        });

        if (!updateResponse.ok) {
          console.error(`Failed to update variant ${variant.variantId}`);
        }
      });

      await Promise.all(updates);
      console.log(`✅ Added components to ${relevantVariants.length} variants for part "${partName}"`);
      
      // Refresh data
      await fetchProducts();
      setIsComponentModalOpen(false);
      setSelectedComponents([]);
      setEditingOption(null);
      setLastComponentsByPart(prev => ({ ...prev, [partName]: selectedComponents }));
    } catch (error) {
      console.error('Error adding components to option:', error);
      alert('Error adding components. Please try again.');
    }
  }, [selectedComponents, products, fetchProducts]);

  // Bulk save all pending edits, sequentially with a tiny delay and progress
  const handleSaveAllPending = useCallback(async () => {
    const pendingParts = Object.keys(editingData);
    if (pendingParts.length === 0) return;
    setIsSavingAll(true);
    setSaveAllProgress({ done: 0, total: pendingParts.length });
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < pendingParts.length; i++) {
      const part = pendingParts[i];
      try {
        await handleSaveOptionInline(part);
      } catch (e) {
        console.error('Bulk save error for part', part, e);
      }
      setSaveAllProgress({ done: i + 1, total: pendingParts.length });
      await delay(150); // gentle rate limit to reduce 500s
    }
    setIsSavingAll(false);
  }, [editingData, handleSaveOptionInline]);

  const handleVerifyFix = useCallback(async () => {
    try {
      setVerifyResult(null);
      const body: any = { partName: verifyPartName.trim(), fix: true };
      if (verifyMeat.trim() !== '') body.meat = verifyMeat.trim();
      if (verifyTimer.trim() !== '') body.timer = Number(verifyTimer);
      if (verifyOption.trim() !== '') body.option = verifyOption.trim();
      const res = await fetch('/api/variants/verify-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setVerifyResult(data);
      // Refresh data so UI reflects any repairs
      await fetchProducts();
    } catch (e) {
      setVerifyResult({ error: 'Failed to verify/fix' });
    }
  }, [verifyPartName, verifyMeat, verifyTimer, verifyOption, fetchProducts]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading variants...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Variant Parts ({filteredRows.length})</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search variant options..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Button 
            onClick={fetchProducts}
            variant="outline"
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={()=>{ setIsVerifyOpen(true); setVerifyPartName(''); setVerifyMeat(''); setVerifyTimer(''); setVerifyOption(''); }}>
            Verify & Fix
          </Button>
          <Button onClick={()=>{ setIsCleanOpen(true); setCleanResult(null); }} variant="outline">
            Clean Option Indices
          </Button>
          <Button onClick={()=>{ setIsVerifyAllOpen(true); setVerifyAllResult(null); }}>
            Verify & Fix All
          </Button>
          <Button 
            onClick={async () => {
              setIsMigratingServeware(true);
              try {
                const res = await fetch('/api/variants/migrate-serveware', { method: 'POST' });
                const data = await res.json();
                setServewareMigrationResult(data);
                await fetchProducts();
              } catch (e) {
                setServewareMigrationResult({ error: 'Failed to migrate' });
              } finally {
                setIsMigratingServeware(false);
              }
            }}
            disabled={isMigratingServeware}
            variant="outline"
            title="Auto-set serveware for Yes Serveware variants"
          >
            {isMigratingServeware ? 'Migrating...' : 'Auto-Detect SW'}
          </Button>
          {Object.keys(editingData).length > 0 && (
            <Button
              onClick={handleSaveAllPending}
              disabled={isSavingAll}
              className="flex items-center gap-2"
              title="Save all pending edits sequentially"
            >
              {isSavingAll ? `Saving ${saveAllProgress.done}/${saveAllProgress.total}` : `Save All Changes (${Object.keys(editingData).length})`}
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Variant Part</TableHead>
              <TableHead>Meat</TableHead>
              <TableHead>Timer (min)</TableHead>
              <TableHead>Option</TableHead>
              <TableHead>SW</TableHead>
              <TableHead>Components</TableHead>
              <TableHead className="w-32">Count</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const editingOptionData = editingData[row.partName] || {} as VariantOptionFormData;
              const agg = computePartAggregates(row.partName);
              const compList = computePartComponents(row.partName);
              const hasChanges = Object.keys(editingOptionData).length > 0;
              
              return (
                <TableRow key={row.partName}>
                  <TableCell className="font-medium">
                    <div className="max-w-64">
                      <div className="text-sm font-semibold">{row.partName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingOptionData.meat ?? (editingOptionData as any).meat1 ?? (agg.meat ?? '')}
                      onChange={(e) => handleInlineEdit(row.partName, 'meat', e.target.value)}
                      placeholder="e.g., C"
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={editingOptionData.timer ?? (editingOptionData as any).timer1 ?? (agg.timer ?? '')}
                      onChange={(e) => handleInlineEdit(row.partName, 'timer', e.target.value ? Number(e.target.value) : null)}
                      placeholder="30"
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingOptionData.option ?? (editingOptionData as any).option1 ?? (agg.option ?? '')}
                      onChange={(e) => handleInlineEdit(row.partName, 'option', e.target.value)}
                      placeholder="GF"
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const current = editingOptionData.serveware ?? agg.serveware ?? false;
                        handleInlineEdit(row.partName, 'serveware', !current);
                      }}
                      className="flex items-center justify-center w-full"
                    >
                      {(editingOptionData.serveware ?? agg.serveware) ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[260px] truncate text-xs text-gray-600">
                      {compList.length === 0 ? (
                        <span className="text-gray-400">None</span>
                      ) : (
                        <span title={compList.join(', ')}>
                          {compList.slice(0, 4).join(', ')}{compList.length > 4 ? ` +${compList.length - 4}` : ''}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm text-gray-600">
                      {products.reduce((count, product) => {
                        if (Array.isArray(product.variants)) {
                          return count + product.variants.filter(variant => 
                            (variant.shopifyName || variant.shopifyTitle || '').split(' / ').map(p => p.trim()).includes(row.partName)
                          ).length;
                        }
                        return count;
                      }, 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {hasChanges && (
                        <Button
                          size="sm"
                          onClick={() => handleSaveOptionInline(row.partName)}
                          className="h-8 px-2"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingOption(row.partName);
                          setIsComponentModalOpen(true);
                        }}
                        className="h-8 px-2"
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Verify & Fix Modal (admin) */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify & Fix Variants by Part</DialogTitle>
            <DialogDescription>
              Checks all variants whose title contains the part. If values are missing at the correct index, fixes them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Part name (as appears in variant title)</Label>
              <Input value={verifyPartName} onChange={(e)=>setVerifyPartName(e.target.value)} placeholder="e.g., Chilli Chicken (DF)" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Meat (optional)</Label>
                <Input value={verifyMeat} onChange={(e)=>setVerifyMeat(e.target.value)} placeholder="e.g., Ct" />
              </div>
              <div>
                <Label>Timer (optional)</Label>
                <Input value={verifyTimer} onChange={(e)=>setVerifyTimer(e.target.value)} type="number" placeholder="e.g., 30" />
              </div>
              <div>
                <Label>Option (optional)</Label>
                <Input value={verifyOption} onChange={(e)=>setVerifyOption(e.target.value)} placeholder="e.g., GF" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setIsVerifyOpen(false)}>Close</Button>
              <Button onClick={handleVerifyFix}>Verify & Fix</Button>
            </div>
            {verifyResult && (
              <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(verifyResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Verify & Fix All Modal */}
      <Dialog open={isVerifyAllOpen} onOpenChange={setIsVerifyAllOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify & Fix All Visible Parts</DialogTitle>
            <DialogDescription>
              Runs verification for every part currently listed (after search filter). Uses any pending edits you’ve entered for Meat/Timer/Option; leaves fields untouched if not provided.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Parts to process: {filteredRows.length}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setIsVerifyAllOpen(false)}>Close</Button>
              <Button onClick={async ()=>{
                try {
                  setVerifyAllResult(null);
                  const parts = filteredRows.map(row => {
                    const edit = editingData[row.partName] || {} as any;
                    const agg = computePartAggregates(row.partName);
                    const payload: any = { partName: row.partName };
                    // Prefer explicit edits; otherwise fall back to consensus values
                    if (edit.meat !== undefined && edit.meat !== '') {
                      payload.meat = edit.meat;
                    } else if (agg.meat !== undefined) {
                      payload.meat = agg.meat;
                    }
                    if (edit.timer !== undefined && edit.timer !== null) {
                      payload.timer = Number(edit.timer);
                    } else if (agg.timer !== undefined && agg.timer !== null) {
                      payload.timer = Number(agg.timer);
                    }
                    if (edit.option !== undefined && edit.option !== '') {
                      payload.option = edit.option;
                    } else if (agg.option !== undefined) {
                      payload.option = agg.option;
                    }
                    return payload;
                  });
                  const res = await fetch('/api/variants/verify-all', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parts, fix: true })
                  });
                  const data = await res.json();
                  setVerifyAllResult(data);
                  await fetchProducts();
                } catch (e) {
                  setVerifyAllResult({ error: 'Failed to verify all' });
                }
              }}>Run Verify & Fix All</Button>
            </div>
            {verifyAllResult && (
              <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border max-h-80 overflow-auto">
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(verifyAllResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Components Modal */}
      <Dialog open={isComponentModalOpen} onOpenChange={(open) => {
        setIsComponentModalOpen(open);
        if (!open) {
          setEditingOption(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Components to Option: {editingOption}</DialogTitle>
            <DialogDescription>
              Add components to all variants that contain this option
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Components to Add</Label>
              <IngredientSelector
                onIngredientsChange={setSelectedComponents}
                initialIngredients={[]}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsComponentModalOpen(false);
                  setEditingOption(null);
                  setSelectedComponents([]);
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => editingOption && handleAddComponentsToOption(editingOption)}
                disabled={selectedComponents.length === 0}
              >
                Add {selectedComponents.length} Components to {editingOption} Variants
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clean Option Indices (admin) */}
      <Dialog open={isCleanOpen} onOpenChange={setIsCleanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clean Option Indices</DialogTitle>
            <DialogDescription>
              Nulls any meats/timers at indices ≥ 2 across all variants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setIsCleanOpen(false)}>Close</Button>
              <Button onClick={async ()=>{
                try {
                  setCleanResult(null);
                  const res = await fetch('/api/variants/cleanup-options', { method: 'POST' });
                  const data = await res.json();
                  setCleanResult(data);
                  await fetchProducts();
                } catch (e) {
                  setCleanResult({ error: 'Failed to clean options' });
                }
              }}>Run Cleanup</Button>
            </div>
            {cleanResult && (
              <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border">
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(cleanResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
