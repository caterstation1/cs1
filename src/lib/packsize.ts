// Utilities to parse supplier pack sizes and derive per-unit pricing

export type ParsedPackSize = {
  totalAmount: number; // in base units (kg or l) when applicable, else count of pieces
  perPieceAmount?: number; // amount per piece (kg or l) when applicable
  baseUnit: 'kg' | 'l' | 'unit';
  multiplierChain: number[]; // e.g. [4, 3] for 4x3kg
};

const UNIT_REGEX = /([\d,.]+)\s*(kg|g|l|ml|each|ea|pc|pk|pkt|pack)/i;

function toNumber(value: string): number {
  const cleaned = value.replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeUnit(unit: string): 'kg' | 'l' | 'unit' {
  const u = unit.toLowerCase();
  if (u === 'kg' || u === 'kilo' || u === 'kilogram') return 'kg';
  if (u === 'g' || u === 'gram' || u === 'grams') return 'kg';
  if (u === 'l' || u === 'lt' || u === 'liter' || u === 'litre') return 'l';
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return 'l';
  return 'unit';
}

function convertToBase(amount: number, unit: string): { value: number; base: 'kg' | 'l' | 'unit' } {
  const u = unit.toLowerCase();
  if (u === 'kg') return { value: amount, base: 'kg' };
  if (u === 'g') return { value: amount / 1000, base: 'kg' };
  if (u === 'l') return { value: amount, base: 'l' };
  if (u === 'ml') return { value: amount / 1000, base: 'l' };
  return { value: amount, base: 'unit' };
}

export function parsePackSize(packSizeRaw?: string): ParsedPackSize | null {
  if (!packSizeRaw) return null;
  const pack = packSizeRaw.replace(/\s+/g, '').toLowerCase();

  // Common patterns: 4x3kg, 12x500g, 24x330ml, 700ml, 1kg, 3x1.97kg
  // Split by 'x' to find multipliers and final amount+unit
  const parts = pack.split('x');
  const multipliers: number[] = [];
  let amountPart = parts[parts.length - 1];

  // Collect numeric multipliers for all but the last part (when purely numeric)
  for (let i = 0; i < parts.length - 1; i++) {
    const m = toNumber(parts[i]);
    if (m > 0) multipliers.push(m);
  }

  // Extract amount+unit from the last part
  const match = amountPart.match(UNIT_REGEX);
  if (!match) {
    // Could be pure count like '24pc' or ambiguous; treat as unit count
    const count = toNumber(amountPart);
    const totalPieces = multipliers.reduce((a, b) => a * b, 1) * (count > 0 ? count : 1);
    return {
      totalAmount: totalPieces,
      baseUnit: 'unit',
      multiplierChain: multipliers,
    };
  }

  const amount = toNumber(match[1]);
  const unit = match[2];
  const base = convertToBase(amount, unit);

  const chainMultiplier = multipliers.reduce((a, b) => a * b, 1) || 1;
  const totalAmount = base.value * chainMultiplier;

  return {
    totalAmount,
    perPieceAmount: base.value, // last item amount per piece
    baseUnit: base.base,
    multiplierChain: multipliers,
  };
}

const CASE_UOMS = new Set(['case', 'carton', 'ctn', 'tray', 'sleeve']);
const PIECE_UOMS = new Set(['each', 'ea', 'bag', 'bottle', 'jar', 'tin', 'pack', 'packet', 'roll', 'pc']);
const WEIGHT_PRICE_UOMS = new Set(['kg', 'kilo']);
const VOLUME_PRICE_UOMS = new Set(['l', 'liter', 'litre']);

export function deriveUnitPricing(opts: {
  packSize?: string;
  uom?: string;
  ctnQty?: number | string | null;
  price?: number;
}): { derivedUnit: 'kg' | 'l' | 'unit'; derivedCostPerUnit: number; confidence: number } | null {
  const { packSize, uom, ctnQty, price } = opts;
  const p = typeof price === 'number' ? price : NaN;
  if (!isFinite(p)) return null;
  const parsed = parsePackSize(packSize);
  const u = (uom || '').toLowerCase();
  const ctn = typeof ctnQty === 'string' ? toNumber(ctnQty) : (ctnQty || 0);

  // If price is clearly per weight or volume already
  if (WEIGHT_PRICE_UOMS.has(u)) return { derivedUnit: 'kg', derivedCostPerUnit: p, confidence: 0.9 };
  if (VOLUME_PRICE_UOMS.has(u)) return { derivedUnit: 'l', derivedCostPerUnit: p, confidence: 0.9 };

  if (!parsed) return null;

  // Determine whether price is per case or per piece based on UOM
  const isCase = CASE_UOMS.has(u);
  const isPiece = PIECE_UOMS.has(u) || !isCase;

  if (parsed.baseUnit === 'unit') {
    // Not weight/volume; can't step-down meaningfully
    return { derivedUnit: 'unit', derivedCostPerUnit: p, confidence: 0.3 };
  }

  // If price is per case, divide by total amount in case
  if (isCase) {
    const perBase = parsed.totalAmount > 0 ? p / parsed.totalAmount : p;
    return { derivedUnit: parsed.baseUnit, derivedCostPerUnit: perBase, confidence: 0.8 };
  }

  // If price is per piece (bag/bottle/jar/etc.), divide by amount per piece
  const perPieceAmount = parsed.perPieceAmount || (ctn > 0 ? parsed.totalAmount / ctn : 0);
  const perBase = perPieceAmount > 0 ? p / perPieceAmount : (parsed.totalAmount > 0 ? p / parsed.totalAmount : p);
  // Confidence higher if perPieceAmount was explicit
  const confidence = parsed.perPieceAmount ? 0.9 : 0.7;
  return { derivedUnit: parsed.baseUnit, derivedCostPerUnit: perBase, confidence };
}





