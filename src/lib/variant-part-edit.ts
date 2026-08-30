// Shared logic for editing per-part variant data (meats/timers/options).
//
// Two stores exist on ProductVariant:
//  - legacy scalars meat1/meat2, timer1/timer2, option1/option2 — read by the
//    operational surfaces (runsheets, labels), so they are the fields that
//    must never be silently emptied;
//  - JSON arrays meats/timers/options aligned to the ' / '-separated parts of
//    the variant title — the Variants tab's editing model.
//
// The historical bug: routes mirrored arrays[0]/[1] onto the legacy scalars
// wholesale, so a junk array slot ("" left by an earlier write) would wipe a
// real legacy value on the next unrelated save. The fix is to seed empty
// array slots 0/1 from the legacy scalars BEFORE applying any edit; after
// that the mirror is safe by construction.

export interface VariantPartFields {
  shopifyName: string
  meats: unknown
  timers: unknown
  options: unknown
  meat1: string | null
  meat2: string | null
  timer1: number | null
  timer2: number | null
  option1: string | null
  option2: string | null
}

export interface PartArrays {
  parts: string[]
  meats: (string | null)[]
  timers: (number | null)[]
  options: (string | null)[]
}

export function splitParts(title: string): string[] {
  return (title || '')
    .split(' / ')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

const isEmpty = (v: unknown) => v == null || String(v).trim() === ''

function toArr<T>(value: unknown, legacy: [T | null, T | null]): (T | null)[] {
  return Array.isArray(value) ? (value as (T | null)[]).map((x) => (x ?? null)) : [legacy[0], legacy[1]]
}

function ensureLen<T>(arr: (T | null)[], index: number) {
  while (arr.length <= index) arr.push(null)
}

/**
 * Loads the arrays for a variant, seeding empty slots 0/1 from the legacy
 * scalars so the legacy values can never be lost by the mirror.
 */
export function loadPartArrays(v: VariantPartFields): PartArrays {
  const parts = splitParts(v.shopifyName)
  const meats = toArr<string>(v.meats, [v.meat1, v.meat2])
  const timers = toArr<number>(v.timers, [v.timer1, v.timer2])
  const options = toArr<string>(v.options, [v.option1, v.option2])

  ensureLen(meats, 1); ensureLen(timers, 1); ensureLen(options, 1)
  const legacyMeats = [v.meat1, v.meat2]
  const legacyTimers = [v.timer1, v.timer2]
  const legacyOptions = [v.option1, v.option2]
  for (const i of [0, 1]) {
    if (isEmpty(meats[i]) && !isEmpty(legacyMeats[i])) meats[i] = legacyMeats[i]
    if (timers[i] == null && legacyTimers[i] != null) timers[i] = legacyTimers[i]
    if (isEmpty(options[i]) && !isEmpty(legacyOptions[i])) options[i] = legacyOptions[i]
  }

  return { parts, meats, timers, options }
}

export interface PartEdit {
  meat?: string | null
  timer?: number | null
  option?: string | null
}

export interface ApplyOptions {
  /** Only write values that are currently empty (verify-and-fix semantics). */
  onlyIfMissing?: boolean
}

/**
 * Applies an edit at every index of the title matching partName. Any index
 * that corresponds to a real title part is editable — three-meat titles
 * ("A / B / C") store their third meat at index 2.
 * Returns the indices that were reported (missing or written).
 */
export function applyPartEdit(
  arrays: PartArrays,
  partName: string,
  edit: PartEdit,
  opts: ApplyOptions = {}
): number[] {
  const touched: number[] = []
  arrays.parts.forEach((part, idx) => {
    if (part !== partName) return
    ensureLen(arrays.meats, idx); ensureLen(arrays.timers, idx); ensureLen(arrays.options, idx)

    const wantMeat = edit.meat !== undefined && (!opts.onlyIfMissing || isEmpty(arrays.meats[idx]))
    const wantTimer = edit.timer !== undefined && (!opts.onlyIfMissing || arrays.timers[idx] == null)
    const wantOption = edit.option !== undefined && (!opts.onlyIfMissing || isEmpty(arrays.options[idx]))
    if (!wantMeat && !wantTimer && !wantOption) return

    touched.push(idx)
    if (wantMeat) arrays.meats[idx] = edit.meat ?? null
    if (wantTimer) arrays.timers[idx] = edit.timer ?? null
    if (wantOption) arrays.options[idx] = edit.option ?? null
  })
  return touched
}

/**
 * The Prisma update payload: arrays plus the legacy mirror. Safe because
 * loadPartArrays seeded slots 0/1 from legacy before any edit.
 */
export function partArraysUpdateData(arrays: PartArrays): Record<string, unknown> {
  return {
    meats: arrays.meats,
    timers: arrays.timers,
    options: arrays.options,
    meat1: arrays.meats[0] ?? null,
    meat2: arrays.meats[1] ?? null,
    timer1: arrays.timers[0] ?? null,
    timer2: arrays.timers[1] ?? null,
    option1: arrays.options[0] ?? null,
    option2: arrays.options[1] ?? null,
  }
}

/** Option-style parts ("Yes Serveware", "No GF Rolls") never carry meat/timer. */
export function isOptionPart(part: string): boolean {
  return /^(yes|no)\b/i.test(part.trim())
}
