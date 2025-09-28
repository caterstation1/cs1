"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ImageMeta = { url: string; alt?: string | null }

export interface ComponentCardProps {
  name: string
  description?: string
  ingredients: { name: string; quantity: number; unit: string; source?: string; id?: string; code?: string; supplier?: string; brand?: string; _componentBreakdown?: any[] }[]
  images?: ImageMeta[]
  allergens: string[]
  dietary: string[]
  producedQuantity?: number
  producedUnit?: string
  expandAll?: boolean // when true, remove scroll constraints for export/download
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, description, ingredients, images, allergens, dietary, producedQuantity, producedUnit, expandAll = false }) => {
  console.log('ComponentCard rendered with expandAll:', expandAll, 'for component:', name)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [nestedComponent, setNestedComponent] = useState<any | null>(null)
  const [componentBreakdowns, setComponentBreakdowns] = useState<Record<string, any[]>>({})
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set())
  
  // For download version (expandAll=true), automatically expand all breakdowns
  const shouldShowExpanded = expandAll
  console.log('shouldShowExpanded calculated as:', shouldShowExpanded, 'for component:', name)

  const openNested = async (ing: { name: string; source?: string; id?: string }) => {
    try {
      // Prefer by id when available
      if (ing.id) {
        const res = await fetch(`/api/components/${ing.id}`)
        if (res.ok) {
          const data = await res.json()
          setNestedComponent(data)
          setNestedOpen(true)
          return
        }
      }
      // Fallback: fetch catalog and match by name
      const res = await fetch('/api/components')
      if (!res.ok) return
      const list = await res.json()
      const arr = Array.isArray(list) ? list : (list.components || [])
      const key = (ing.name || '').toLowerCase().trim()
      const found = arr.find((c: any) => (c?.name || '').toLowerCase().trim() === key)
      if (found) {
        setNestedComponent(found)
        setNestedOpen(true)
      }
    } catch {}
  }

  const loadComponentBreakdown = async (ing: { name: string; source?: string; id?: string; _componentBreakdown?: any[] }, forceRefresh = false) => {
    const componentKey = ing.id || ing.name
    
    // Only load if we don't already have it, unless forcing refresh
    if (componentBreakdowns[componentKey] && !forceRefresh) {
      console.log('Component breakdown already loaded for:', ing.name)
      return
    }
    
    // If breakdown is already preloaded (for download), use it
    if (ing._componentBreakdown) {
      console.log('Using preloaded breakdown for:', ing.name, 'data:', ing._componentBreakdown)
      setComponentBreakdowns(prev => ({
        ...prev,
        [componentKey]: ing._componentBreakdown || []
      }))
      return
    }
    
    console.log('Fetching component breakdown for:', ing.name, 'id:', ing.id)
    
    try {
      let componentData = null
      
      // Prefer by id when available
      if (ing.id) {
        console.log('Fetching by ID:', ing.id)
        const res = await fetch(`/api/components/${ing.id}`)
        if (res.ok) {
          componentData = await res.json()
          console.log('Fetched component by ID:', componentData?.name, 'ingredients:', componentData?.ingredients?.length || 0)
        } else {
          console.log('Failed to fetch by ID, status:', res.status)
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
          console.log('Found component by name:', componentData?.name, 'ingredients:', componentData?.ingredients?.length || 0)
        } else {
          console.log('Failed to fetch catalog, status:', res.status)
        }
      }
      
      if (componentData && componentData.ingredients) {
        console.log('Storing breakdown for:', ing.name, 'ingredients:', componentData.ingredients.length)
        // Store the breakdown for this component
        setComponentBreakdowns(prev => ({
          ...prev,
          [componentKey]: componentData.ingredients
        }))
      } else {
        console.log('No component data or ingredients found for:', ing.name)
      }
    } catch (error) {
      console.error('Error loading component breakdown for:', ing.name, error)
    }
  }

  const toggleBreakdownExpansion = (componentKey: string) => {
    setExpandedBreakdowns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(componentKey)) {
        newSet.delete(componentKey)
      } else {
        newSet.add(componentKey)
      }
      return newSet
    })
  }

  const refreshComponentData = async () => {
    // Clear all cached breakdowns and reload them
    setComponentBreakdowns({})
    
    // Reload all component breakdowns with force refresh
    await Promise.all((ingredients || []).map(async (ing) => {
      const src = (ing.source || '').toLowerCase()
      if (src === 'components') {
        await loadComponentBreakdown(ing, true)
      }
    }))
  }
  const displayImages = (images || []).slice(0, 2)
  const [metaById, setMetaById] = useState<Record<string, { code?: string; brand?: string }>>({})

  React.useEffect(() => {
    const load = async () => {
      const out: Record<string, { code?: string; brand?: string }> = {}
      
      // Load ingredient metadata and component breakdowns
      await Promise.all((ingredients || []).map(async (ing) => {
        const id = ing.id
        const src = (ing.source || '').toLowerCase()
        
        // Load ingredient metadata
        if (id) {
          try {
            if (src === 'bidfood') {
              const res = await fetch(`/api/bidfood/${id}`)
              if (res.ok) {
                const p = await res.json()
                out[id] = { code: p.productCode, brand: p.brand }
              }
            } else if (src === 'gilmours') {
              const res = await fetch(`/api/gilmours/${id}`)
              if (res.ok) {
                const p = await res.json()
                out[id] = { code: p.sku, brand: p.brand }
              }
            }
          } catch {}
        }
        
        // Load component breakdowns - always load for components
        if (src === 'components') {
          console.log('Loading component breakdown for:', ing.name, 'expandAll:', expandAll)
          await loadComponentBreakdown(ing)
        }
      }))
      
      setMetaById(out)
    }
    load()
  }, [ingredients])
  const pills = [...allergens, ...dietary]
  return (
    <div className={`w-[420px] md:w-[496px] ${expandAll ? 'min-h-fit pb-4' : 'min-h-[700px]'} bg-[#FFF8E2] text-[#4A0000] rounded-2xl border-2 border-[#FF701F] shadow-sm p-6 relative overflow-hidden`}>
      {/* subtle tech dot pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#4A0000 0.75px, transparent 0.75px)', backgroundSize: '12px 12px' }} />
      <div className={`relative flex flex-col gap-4 ${expandAll ? '' : 'h-full'}`}>
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex-1"></div>
          <h2 className="text-2xl font-extrabold tracking-tight text-center flex-1">{name}</h2>
          <div className="flex-1 flex justify-end">
            {!expandAll && (
              <button
                onClick={refreshComponentData}
                className="text-xs px-2 py-1 bg-[#FF701F] text-white rounded hover:bg-[#FF701F]/80 transition-colors"
                title="Refresh component data"
              >
                🔄
              </button>
            )}
          </div>
        </div>

        {/* Images */}
        {displayImages.length > 0 && (
          <div className={displayImages.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-3 place-items-center'}>
            {displayImages.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.url}
                alt={img.alt || ''}
                className={
                  'aspect-[4/3] object-cover rounded-xl border border-[#FF701F]/50 drop-shadow-md ' +
                  (displayImages.length === 1 ? 'w-3/4' : 'w-full')
                }
              />
            ))}
          </div>
        )}

        {/* Ingredients */}
        <div>
          <h3 className="text-sm font-bold">Ingredients</h3>
          <ul className={`mt-1 text-xs grid grid-cols-1 ${expandAll ? 'max-h-none' : 'max-h-[110px] overflow-y-auto pr-1'}`}>
            {ingredients.map((ing, idx) => {
              const isComponent = (ing.source || '').toLowerCase() === 'components'
              const componentKey = ing.id || ing.name
              const breakdown = componentBreakdowns[componentKey] || []
              const isBreakdownExpanded = expandedBreakdowns.has(componentKey)
              
              return (
                <li key={idx} className="border-b border-[#4A0000]/10 last:border-none">
                  <div className="grid grid-cols-[80px_1fr] items-center gap-1 py-0">
                    <span className="font-semibold text-xs">{ing.quantity} {ing.unit}</span>
                    {isComponent ? (
                      <div className="text-left">
                        <button
                          type="button"
                          className="underline hover:opacity-80 text-xs"
                          onClick={() => openNested(ing)}
                        >
                          {ing.name}
                        </button>
                        
                        {/* Component breakdown - always show, compact format */}
                        {(() => {
                          console.log('Component breakdown check for:', ing.name, 'breakdown:', breakdown, 'shouldShowExpanded:', shouldShowExpanded)
                          return breakdown.length > 0
                        })() && (
                          <div className="mt-0 text-[6px] text-[#4A0000]/70">
                            {(() => {
                              const maxVisible = 3
                              // For download (expandAll), show all items; otherwise use normal logic
                              const visibleItems = (shouldShowExpanded || isBreakdownExpanded) ? breakdown : breakdown.slice(0, maxVisible)
                              const hasMore = breakdown.length > maxVisible && !shouldShowExpanded
                              
                              return (
                                <>
                                  {visibleItems.map((item: any, breakdownIdx: number) => (
                                    <span key={breakdownIdx}>
                                      {breakdownIdx > 0 && ' | '}
                                      {item.quantity} {item.unit} {item.code || item.name}
                                    </span>
                                  ))}
                                  {hasMore && !isBreakdownExpanded && !shouldShowExpanded && (
                                    <>
                                      {' | '}
                                      <button
                                        type="button"
                                        className="underline hover:opacity-80"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleBreakdownExpansion(componentKey)
                                        }}
                                      >
                                        ... ({breakdown.length - maxVisible} more)
                                      </button>
                                    </>
                                  )}
                                  {hasMore && isBreakdownExpanded && !shouldShowExpanded && (
                                    <>
                                      {' | '}
                                      <button
                                        type="button"
                                        className="underline hover:opacity-80"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleBreakdownExpansion(componentKey)
                                        }}
                                      >
                                        ... less
                                      </button>
                                    </>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-left text-xs">
                        {ing.name}
                        {(() => {
                          const supplier = (ing.supplier || '').toString()
                          const src = supplier.toLowerCase()
                          const resolved = ing.id ? metaById[ing.id] : undefined
                          const preferredCode = resolved?.code || ing.code || ''
                          const brand = ing.brand || resolved?.brand || ''
                          const code = (src === 'bidfood' || src === 'gilmours') ? preferredCode : ''
                          if (!code && (src === 'components' || src === 'other' || src === 'products')) return null
                          if (!code && !supplier) return null
                          return (
                            <div className="text-[6px] text-[#4A0000]/70">
                              {brand ? `${brand} · ` : ''}{code ? `${code} : ` : ''}{supplier}
                            </div>
                          )
                        })()}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {(producedQuantity != null || producedUnit) && (
            <div className="mt-3 text-sm">
              <div className="grid grid-cols-[180px_1fr] gap-3">
                <span className="font-semibold">Yield (final usable)</span>
                <span>
                  {producedQuantity != null ? producedQuantity : '-'} {producedUnit ? String(producedUnit).toUpperCase() : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className={`flex-1 ${expandAll ? 'min-h-fit' : 'min-h-[120px]'}`}>
            <h3 className="text-base font-bold">Description</h3>
            <div className={`mt-2 text-xs whitespace-pre-wrap ${expandAll ? 'pb-4' : 'overflow-y-auto max-h-[180px] pr-1'}`}>
              {description}
            </div>
            {expandAll && <div className="h-2"></div>}
          </div>
        )}

        {/* Footer pills */}
        {pills.length > 0 && (
          <div className="pt-3 border-t border-[#4A0000]/10">
            <div className="flex flex-wrap gap-2">
              {pills.map((p, i) => (
                <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white/60 border border-[#FF701F]/40">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Nested component preview */}
      <Dialog open={nestedOpen} onOpenChange={setNestedOpen}>
        <DialogContent className="max-w-fit">
          <DialogHeader>
            <DialogTitle>Component Card</DialogTitle>
          </DialogHeader>
          {nestedComponent && (
            <ComponentCard
              name={nestedComponent.name}
              description={nestedComponent.description}
              images={(nestedComponent.images || []).slice(0,2).map((i: any) => ({ url: i.url, alt: i.alt }))}
              ingredients={(nestedComponent.ingredients || []).map((i: any) => ({ name: i.name, quantity: i.quantity, unit: i.unit, source: i.source, id: i.id }))}
              allergens={[
                nestedComponent.hasGluten && 'Gluten',
                nestedComponent.hasDairy && 'Dairy',
                nestedComponent.hasSoy && 'Soy',
                nestedComponent.hasOnionGarlic && 'Onion/Garlic',
                nestedComponent.hasSesame && 'Sesame',
                nestedComponent.hasNuts && 'Nuts',
                nestedComponent.hasEgg && 'Egg',
              ].filter(Boolean) as string[]}
              dietary={[
                nestedComponent.isVegetarian && 'Vegetarian',
                nestedComponent.isVegan && 'Vegan',
                nestedComponent.isHalal && 'Halal',
              ].filter(Boolean) as string[]}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


