'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  CircleDot,
  CookingPot,
  Egg,
  Flame,
  Info,
  Leaf,
  Milk,
  Nut,
  Sprout,
  Sandwich,
  Wheat,
} from 'lucide-react'
import { INK } from './label-styles'

export function IconCircle({ Icon, size = 44 }: { Icon: LucideIcon; size?: number }) {
  const iconSize = Math.round(size * 0.68)
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        border: `2px solid ${INK}`,
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

export function getComponentIcon(
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
    return Leaf
  if (tags.includes('onion') || tags.includes('garlic') || n.includes('onion') || n.includes('garlic'))
    return Sprout
  if (tags.includes('sesame') || n.includes('sesame') || n.includes('seed'))
    return CircleDot
  if (tags.includes('nut'))
    return Nut
  if (tags.includes('egg') || n.includes('egg'))
    return Egg
  if (tags.includes('halal'))
    return BadgeCheck
  if (n.includes('rice') || n.includes('grain') || n.includes('bowl'))
    return CookingPot
  if (n.includes('sauce') || n.includes('salsa') || n.includes('cream') || n.includes('mayo'))
    return CookingPot
  if (n.includes('jalape') || n.includes('chilli') || n.includes('chili') || n.includes('spicy'))
    return Flame
  if (n.includes('bagel') || n.includes('sandwich') || n.includes('roll'))
    return Sandwich
  if (n.includes('pasta'))
    return CircleDot

  return Info
}

export const pickComponentIcon = getComponentIcon
