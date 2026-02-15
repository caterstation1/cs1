export function sanitizeNotes(text: string | null | undefined): string {
  if (!text) return ''
  // Remove patterns like: | Delivery Date: Thu Nov 6 2025 | Delivery Time: 12:30 PM - 12:45 PM
  // Also handle variants without leading/trailing pipes and extra spaces
  return text
    .replace(/\s*\|\s*Delivery Date:[^|]+/gi, '')
    .replace(/\s*\|\s*Delivery Time:[^|]+/gi, '')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim()
}



