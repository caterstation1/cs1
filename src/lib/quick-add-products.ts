/**
 * The add-ons staff reach for most often, offered as one-tap buttons at the top
 * of the Add Product dialog so they don't have to search for them.
 *
 * Pinned by variant id rather than SKU on purpose. ADD-TFN and ADD-GFD are each
 * shared by two different products in Shopify (Side of Tofu / Side of Falafel,
 * and x3 Gluten-Friendly Donuts / x3 Gluten-Friendly Bagels), and TaterTots and
 * the GF tacos each exist twice under near-identical names, so looking these up
 * by SKU or title can add the wrong item.
 */

export interface QuickAddProduct {
  variantId: string
  sku: string
  /** Full product title, stored on the line item so it reads the same as a searched item. */
  title: string
  /** Short label for the button face. */
  label: string
}

export const QUICK_ADD_PRODUCTS: QuickAddProduct[] = [
  {
    variantId: '43176438923519',
    sku: 'ADD-TFN',
    title: 'ADDON: Side of Tofu',
    label: 'Side of Tofu',
  },
  {
    variantId: '43098222002431',
    sku: 'ADD-GFR',
    title: 'ADDON: 3 x Gluten friendly rolls',
    label: '3 x GF rolls',
  },
  {
    variantId: '47218180751615',
    sku: 'ADD6GFT',
    title: 'ADDON: 6 x Gluten Friendly Tacos',
    label: '6 x GF tacos',
  },
  {
    variantId: '48469237039359',
    sku: 'ADD-GFD',
    title: 'ADDON: x3 Gluten-Friendly Donuts',
    label: 'x3 GF donuts',
  },
  {
    variantId: '43043839934719',
    sku: 'ADD-CTT',
    title: 'ADDON: Crispy TaterTots',
    label: 'TaterTots',
  },
]
