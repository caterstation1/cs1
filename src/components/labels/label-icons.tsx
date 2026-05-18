'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Beef,
  CircleDot,
  CookingPot,
  Flame,
  Leaf,
  Milk,
  Salad,
  Sandwich,
  Utensils,
  Wheat,
} from 'lucide-react'
import { INK } from './label-styles'

export function IconCircle({ Icon, size = 44 }: { Icon: LucideIcon; size?: number }) {
  const iconSize = Math.round(size * 0.58)
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        border: `1.5px solid ${INK}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
      }}
    >
      <Icon size={iconSize} strokeWidth={2.25} color={INK} aria-hidden />
    </div>
  )
}

export function pickComponentIcon(
  name: string,
  allergens: string[]
): LucideIcon {
  const n = name.toLowerCase()
  const tags = allergens.join(' ').toLowerCase()

  if (tags.includes('gluten') || n.includes('bread') || n.includes('tortilla') || n.includes('wrap'))
    return Wheat
  if (tags.includes('dairy') || tags.includes('milk') || n.includes('cheese') || n.includes('cream'))
    return Milk
  if (tags.includes('vegan') || tags.includes('vegetarian') || n.includes('salad') || n.includes('greens'))
    return Salad
  if (n.includes('meat') || n.includes('chicken') || n.includes('beef') || n.includes('pork'))
    return Beef
  if (n.includes('rice') || n.includes('grain') || n.includes('pasta'))
    return CircleDot
  if (n.includes('sauce') || n.includes('salsa') || n.includes('chipotle'))
    return Flame
  if (n.includes('pot') || n.includes('soup') || n.includes('stew'))
    return CookingPot
  if (n.includes('sandwich') || n.includes('bagel') || n.includes('roll'))
    return Sandwich
  if (n.includes('leaf') || n.includes('herb') || n.includes('garnish'))
    return Leaf

  return Utensils
}
