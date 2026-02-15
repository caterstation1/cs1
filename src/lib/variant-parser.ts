/**
 * Utility functions for parsing variant titles into individual components
 */

export interface ParsedVariant {
  parts: string[];
  meat1?: string;
  meat2?: string;
  option1?: string;
  option2?: string;
  timer1?: number;
  timer2?: number;
}

/**
 * Parse a variant title like "Chicken (DF) / Lamb (DF) (GF) (H) / Yes Serveware"
 * into individual components
 */
export function parseVariantTitle(variantTitle: string): ParsedVariant {
  if (!variantTitle || typeof variantTitle !== 'string') {
    return { parts: [] };
  }

  // Split by ' / ' which appears to be the separator in your examples
  const parts = variantTitle.split(' / ').map(part => part.trim()).filter(part => part.length > 0);
  
  const result: ParsedVariant = { parts };
  
  // Try to extract meat components and options from the parts
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Look for meat components (usually the first 1-2 parts)
    if (i < 2 && (part.includes('Chicken') || part.includes('Lamb') || part.includes('Beef') || 
                  part.includes('Pork') || part.includes('Tofu') || part.includes('Pull'))) {
      if (i === 0) {
        result.meat1 = part;
      } else if (i === 1) {
        result.meat2 = part;
      }
    }
    
    // Look for serveware options
    if (part.toLowerCase().includes('serveware')) {
      result.option1 = part;
    }
    
    // Look for dietary options in parentheses
    if (part.includes('(DF)') || part.includes('(GF)') || part.includes('(H)') || part.includes('(V*)')) {
      if (!result.option2) {
        // Extract just the dietary options part
        const dietaryMatch = part.match(/\(([^)]+)\)/g);
        if (dietaryMatch) {
          result.option2 = dietaryMatch.join(' ');
        }
      }
    }
  }
  
  return result;
}

/**
 * Extract unique options from a list of variant titles for a product
 */
export function extractUniqueOptions(variantTitles: string[]): string[] {
  const uniqueOptions = new Set<string>();
  
  for (const title of variantTitles) {
    const parsed = parseVariantTitle(title);
    parsed.parts.forEach(part => uniqueOptions.add(part));
  }
  
  return Array.from(uniqueOptions).sort();
}
