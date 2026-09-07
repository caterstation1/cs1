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

type FlatRow = Record<string, unknown>

export function pushFlattenedRows(rows: FlatRow[], section: string, payload: unknown, parentKey?: string) {
  if (payload == null) {
    rows.push({ section, key: parentKey || '', value: '' })
    return
  }
  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => {
      if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
        Object.entries(entry as Record<string, unknown>).forEach(([k, v]) => {
          rows.push({ section, key: `${parentKey || 'item'}[${index}].${k}`, value: typeof v === 'object' ? JSON.stringify(v) : v })
        })
      } else {
        rows.push({ section, key: `${parentKey || 'item'}[${index}]`, value: String(entry) })
      }
    })
    return
  }
  if (typeof payload === 'object') {
    Object.entries(payload as Record<string, unknown>).forEach(([k, v]) => {
      if (v != null && typeof v === 'object') {
        pushFlattenedRows(rows, section, v, parentKey ? `${parentKey}.${k}` : k)
      } else {
        rows.push({ section, key: parentKey ? `${parentKey}.${k}` : k, value: v ?? '' })
      }
    })
    return
  }
  rows.push({ section, key: parentKey || '', value: String(payload) })
}

/** Flatten one or more section payloads into a section/key/value CSV string. */
export function sectionsToCsv(sections: Array<[string, unknown]>): string {
  const rows: FlatRow[] = []
  for (const [section, payload] of sections) pushFlattenedRows(rows, section, payload)
  return toCsv(rows, ['section', 'key', 'value'])
}
