// Expand component ingredients recursively into raw leaves
// Raw leaf = ingredient whose name does not resolve to a Component with its own ingredients.
// Aggregates by (id if resolvable, else lowercased name) and unit (no conversions v1).

export interface ComponentRecord {
  id: string
  name: string
  ingredients?: Array<{ name: string; quantity?: number; unit?: string }>
}

export interface RawLeaf {
  id?: string
  name: string
  unit?: string
  qty: number
}

type CompMap = Map<string, ComponentRecord>

function keyFor(id: string | undefined, name: string, unit?: string) {
  return `${id || name.toLowerCase()}::${unit || ''}`
}

export function buildComponentMap(components: any[]): CompMap {
  const map = new Map<string, ComponentRecord>()
  for (const c of components) {
    const name = (c?.name || '').toString().trim()
    if (!name) continue
    const ings: Array<{ name: string; quantity?: number; unit?: string }> = Array.isArray(c.ingredients)
      ? c.ingredients
      : []
    map.set(name.toLowerCase(), { id: String(c.id), name, ingredients: ings })
  }
  return map
}

export function expandToRawLeaves(
  compMap: CompMap,
  inputs: Array<{ name: string; quantity?: number; unit?: string }>,
  factor: number = 1
): RawLeaf[] {
  const out = new Map<string, RawLeaf>()
  const visited = new Set<string>()

  const add = (id: string | undefined, name: string, unit: string | undefined, qty: number) => {
    const k = keyFor(id, name, unit)
    const existing = out.get(k)
    if (existing) existing.qty += qty
    else out.set(k, { id, name, unit, qty })
  }

  const recurse = (name: string, qty: number, unit?: string) => {
    const key = name.toLowerCase()
    const comp = compMap.get(key)
    // If no component record or no sub-ingredients, treat as raw leaf
    if (!comp || !Array.isArray(comp.ingredients) || comp.ingredients.length === 0) {
      add(comp?.id, name, unit, qty)
      return
    }
    // cycle guard
    const cycKey = `${comp.id}:${unit || ''}`
    if (visited.has(cycKey)) {
      // break cycle: treat as raw to avoid infinite loop
      add(comp.id, comp.name, unit, qty)
      return
    }
    visited.add(cycKey)
    for (const ing of comp.ingredients) {
      const childName = (ing?.name || '').toString().trim()
      if (!childName) continue
      const childQty = (typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity || '1'))) || 1
      const childUnit = ing.unit
      recurse(childName, qty * childQty, childUnit)
    }
    visited.delete(cycKey)
  }

  for (const ing of inputs) {
    const name = (ing?.name || '').toString().trim()
    if (!name) continue
    const q = (typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity || '1'))) || 1
    recurse(name, q * factor, ing.unit)
  }

  return Array.from(out.values())
}



