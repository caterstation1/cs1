import { prisma } from '@/lib/prisma'

type AllergenKey =
  | 'gluten'
  | 'dairy'
  | 'soy'
  | 'onionGarlic'
  | 'sesame'
  | 'nuts'
  | 'egg'

const COMPONENT_FLAG: Record<AllergenKey, string> = {
  gluten: 'hasGluten',
  dairy: 'hasDairy',
  soy: 'hasSoy',
  onionGarlic: 'hasOnionGarlic',
  sesame: 'hasSesame',
  nuts: 'hasNuts',
  egg: 'hasEgg',
}

const OTHER_ALLERGEN_ALIASES: Record<AllergenKey, string[]> = {
  gluten: ['gluten'],
  dairy: ['dairy', 'milk'],
  soy: ['soy'],
  onionGarlic: ['onion', 'garlic'],
  sesame: ['sesame'],
  nuts: ['nuts'],
  egg: ['egg'],
}

export function componentHasAllergen(
  component: Record<string, unknown>,
  allergen: AllergenKey,
): boolean {
  return Boolean(component[COMPONENT_FLAG[allergen]])
}

export function otherProductHasAllergen(
  allergens: string[] | null | undefined,
  allergen: AllergenKey,
): boolean {
  if (!Array.isArray(allergens)) return false
  const aliases = OTHER_ALLERGEN_ALIASES[allergen]
  return allergens.some((a) => aliases.includes(String(a || '').trim().toLowerCase()))
}

type IngredientRef = { id?: string; name?: string; source?: string }

function mergeIngredients(base: unknown, variant: unknown): IngredientRef[] {
  const baseArr = Array.isArray(base) ? base : []
  const varArr = Array.isArray(variant) ? variant : []
  return [...baseArr, ...varArr] as IngredientRef[]
}

export async function resolveProductAllergen(
  menuName: string,
  allergen: AllergenKey,
): Promise<{
  matches: Array<{ type: string; name: string; contains: boolean; sources: string[] }>
  components: Array<Record<string, unknown>>
  variants: Array<Record<string, unknown>>
}> {
  const search = menuName.trim()

  const [components, otherProducts, variants, products, allComponents, allOther] =
    await Promise.all([
      prisma.component.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          hasGluten: true,
          hasDairy: true,
          hasSoy: true,
          hasOnionGarlic: true,
          hasSesame: true,
          hasNuts: true,
          hasEgg: true,
        },
        take: 10,
      }),
      prisma.otherProduct.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        select: { id: true, name: true, preferredAllergens: true },
        take: 10,
      }),
      prisma.productVariant.findMany({
        where: {
          OR: [
            { shopifyName: { contains: search, mode: 'insensitive' } },
            { shopifyTitle: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        },
        include: {
          product: {
            select: { productTitle: true, displayName: true, baseIngredients: true },
          },
        },
        take: 10,
      }),
      prisma.shopifyProduct.findMany({
        where: {
          OR: [
            { productTitle: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true, productTitle: true, displayName: true, baseIngredients: true },
        take: 5,
      }),
      prisma.component.findMany({
        select: {
          id: true,
          name: true,
          hasGluten: true,
          hasDairy: true,
          hasSoy: true,
          hasOnionGarlic: true,
          hasSesame: true,
          hasNuts: true,
          hasEgg: true,
        },
      }),
      prisma.otherProduct.findMany({
        select: { id: true, name: true, preferredAllergens: true },
      }),
    ])

  const fullCompById = new Map(allComponents.map((c) => [c.id, c]))
  const fullCompByName = new Map(allComponents.map((c) => [c.name.toLowerCase(), c]))
  const fullOtherById = new Map(allOther.map((p) => [p.id, p]))
  const fullOtherByName = new Map(allOther.map((p) => [p.name.toLowerCase(), p]))

  const matches: Array<{ type: string; name: string; contains: boolean; sources: string[] }> = []

  for (const comp of components) {
    const contains = componentHasAllergen(comp, allergen)
    matches.push({
      type: 'component',
      name: comp.name,
      contains,
      sources: contains ? [comp.name] : [],
    })
  }

  for (const other of otherProducts) {
    const contains = otherProductHasAllergen(other.preferredAllergens, allergen)
    matches.push({
      type: 'otherProduct',
      name: other.name,
      contains,
      sources: contains ? [other.name] : [],
    })
  }

  for (const variant of variants) {
    const ings = mergeIngredients(variant.product.baseIngredients, variant.ingredients)
    const sources: string[] = []
    for (const ing of ings) {
      const src = (ing.source || '').toLowerCase()
      if (src === 'other') {
        const other =
          (ing.id ? fullOtherById.get(ing.id) : null) ||
          (ing.name ? fullOtherByName.get(ing.name.toLowerCase()) : null)
        if (other && otherProductHasAllergen(other.preferredAllergens, allergen)) {
          sources.push(other.name)
        }
      } else if (!src || src === 'components') {
        const comp =
          (ing.id ? fullCompById.get(ing.id) : null) ||
          (ing.name ? fullCompByName.get(ing.name.toLowerCase()) : null)
        if (comp && componentHasAllergen(comp, allergen)) {
          sources.push(comp.name)
        }
      }
    }
    const displayName =
      variant.displayName ||
      variant.shopifyName ||
      variant.product.displayName ||
      variant.product.productTitle
    matches.push({
      type: 'productVariant',
      name: displayName,
      contains: sources.length > 0,
      sources,
    })
  }

  for (const product of products) {
    const productVariants = variants.filter((v) => v.productId === product.id)
    if (productVariants.length > 0) continue
    const ings = mergeIngredients(product.baseIngredients, null)
    const sources: string[] = []
    for (const ing of ings) {
      const src = (ing.source || '').toLowerCase()
      if (src === 'other') {
        const other =
          (ing.id ? fullOtherById.get(ing.id) : null) ||
          (ing.name ? fullOtherByName.get(ing.name.toLowerCase()) : null)
        if (other && otherProductHasAllergen(other.preferredAllergens, allergen)) {
          sources.push(other.name)
        }
      } else if (!src || src === 'components') {
        const comp =
          (ing.id ? fullCompById.get(ing.id) : null) ||
          (ing.name ? fullCompByName.get(ing.name.toLowerCase()) : null)
        if (comp && componentHasAllergen(comp, allergen)) {
          sources.push(comp.name)
        }
      }
    }
    matches.push({
      type: 'shopifyProduct',
      name: product.displayName || product.productTitle,
      contains: sources.length > 0,
      sources,
    })
  }

  return {
    matches,
    components: components as Array<Record<string, unknown>>,
    variants: variants.map((v) => ({
      id: v.id,
      shopifyName: v.shopifyName,
      shopifyTitle: v.shopifyTitle,
      displayName: v.displayName,
      productTitle: v.product.productTitle,
    })),
  }
}
