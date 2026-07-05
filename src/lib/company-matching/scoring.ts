export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function similarityScore(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const distance = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return Math.max(0, 1 - distance / maxLen)
}

function tokenSet(value: string): Set<string> {
  return new Set(value.split(' ').map((t) => t.trim()).filter(Boolean))
}

export function tokenOverlapScore(a: string, b: string): number {
  const setA = tokenSet(a)
  const setB = tokenSet(b)
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }

  return intersection / Math.max(setA.size, setB.size)
}

export function addressSimilarityScore(a: string, b: string): number {
  const lexical = similarityScore(a, b)
  const overlap = tokenOverlapScore(a, b)
  return Math.max(lexical, overlap)
}
