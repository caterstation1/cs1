function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows.length) {
    if (columns?.length) return `${columns.join(',')}\n`
    return ''
  }
  const keys = columns?.length ? columns : Object.keys(rows[0])
  const header = keys.map(escapeCsvCell).join(',')
  const lines = rows.map((row) => keys.map((key) => escapeCsvCell((row as any)[key])).join(','))
  return [header, ...lines].join('\n')
}
