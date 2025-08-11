"use client"

import React from 'react'

type ImageMeta = { url: string; alt?: string | null }

export interface ComponentCardProps {
  name: string
  description?: string
  ingredients: { name: string; quantity: number; unit: string }[]
  images?: ImageMeta[]
  allergens: string[]
  dietary: string[]
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, description, ingredients, images, allergens, dietary }) => {
  const displayImages = (images || []).slice(0, 2)
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

        {/* Ingredients (fixed space ~5 lines) */}
        <div>
          <h3 className="text-base font-bold">Ingredients</h3>
          <ul className="mt-2 text-sm grid grid-cols-1 max-h-[110px] overflow-y-auto pr-1">
            {ingredients.map((ing, idx) => (
              <li key={idx} className="grid grid-cols-[140px_1fr] items-center gap-3 border-b border-[#4A0000]/10 last:border-none py-1">
                <span className="font-semibold">{ing.quantity} {ing.unit}</span>
                <span className="text-left">{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Description (scroll if long) */}
        {description && (
          <div className="flex-1 min-h-[120px]">
            <h3 className="text-base font-bold">Description</h3>
            <div className="mt-2 text-sm whitespace-pre-wrap overflow-y-auto max-h-[180px] pr-1">
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
    </div>
  )
}


