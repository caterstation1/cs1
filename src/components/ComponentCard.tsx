"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ImageMeta = { url: string; alt?: string | null }

export interface ComponentCardProps {
  name: string
  description?: string
  ingredients: { name: string; quantity: number; unit: string; source?: string; id?: string; code?: string; supplier?: string; brand?: string }[]
  images?: ImageMeta[]
  allergens: string[]
  dietary: string[]
  producedQuantity?: number
  producedUnit?: string
  expandAll?: boolean // when true, remove scroll constraints for export/download
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, description, ingredients, images, allergens, dietary, producedQuantity, producedUnit, expandAll = false }) => {
  const [nestedOpen, setNestedOpen] = useState(false)
  const [nestedComponent, setNestedComponent] = useState<any | null>(null)

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
  const displayImages = (images || []).slice(0, 2)
  const [metaById, setMetaById] = useState<Record<string, { code?: string; brand?: string }>>({})

  React.useEffect(() => {
    const load = async () => {
      const out: Record<string, { code?: string; brand?: string }> = {}
      await Promise.all((ingredients || []).map(async (ing) => {
        const id = ing.id
        const src = (ing.source || '').toLowerCase()
        if (!id) return
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
      }))
      setMetaById(out)
    }
    load()
  }, [ingredients])
  const pills = [...allergens, ...dietary]
  return (
    <div className="w-[420px] md:w-[496px] min-h-[700px] bg-[#FFF8E2] text-[#4A0000] rounded-2xl border-2 border-[#FF701F] shadow-sm p-6 relative overflow-hidden">
      {/* subtle tech dot pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#4A0000 0.75px, transparent 0.75px)', backgroundSize: '12px 12px' }} />
      <div className="relative flex flex-col gap-4 h-full">
        {/* Title */}
        <h2 className="text-2xl font-extrabold tracking-tight text-center">{name}</h2>

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
          <h3 className="text-base font-bold">Ingredients</h3>
          <ul className={`mt-2 text-sm grid grid-cols-1 ${expandAll ? '' : 'max-h-[110px] overflow-y-auto pr-1'}`}>
            {ingredients.map((ing, idx) => {
              const isComponent = (ing.source || '').toLowerCase() === 'components'
              return (
                <li key={idx} className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-[#4A0000]/10 last:border-none py-1">
                  <span className="font-semibold">{ing.quantity} {ing.unit}</span>
                  {isComponent ? (
                    <button
                      type="button"
                      className="text-left underline hover:opacity-80"
                      onClick={() => openNested(ing)}
                    >
                      {ing.name}
                    </button>
                  ) : (
                    <span className="text-left">
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
                          <div className="text-xs text-[#4A0000]/70">
                            {brand ? `${brand} · ` : ''}{code ? `${code} : ` : ''}{supplier}
                          </div>
                        )
                      })()}
                    </span>
                  )}
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
          <div className="flex-1 min-h-[120px]">
            <h3 className="text-base font-bold">Description</h3>
            <div className={`mt-2 text-sm whitespace-pre-wrap ${expandAll ? '' : 'overflow-y-auto max-h-[180px] pr-1'}`}>
              {description}
            </div>
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


