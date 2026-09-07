'use client'

import { Fragment, ReactNode, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { formatValue, ValueFormat } from '@/lib/format'

export interface DataTableColumn<Row> {
  key: string
  label: string
  format?: ValueFormat
  sortable?: boolean
  /** Hidden until enabled through the Columns dropdown (diagnostic fields). */
  defaultHidden?: boolean
  render?: (row: Row) => ReactNode
  className?: string
}

export interface DataTableProps<Row> {
  columns: Array<DataTableColumn<Row>>
  rows: Row[]
  rowKey: (row: Row) => string
  /** Client-side sorting unless onSortChange is provided (server-side). */
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void
  /** Renders an expandable detail row (used for diagnostic fields). */
  renderDetail?: (row: Row) => ReactNode
  /** Show the column-visibility dropdown. */
  columnPicker?: boolean
  maxHeight?: number
  emptyMessage?: string
}

function compareCells(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return String(a).localeCompare(String(b))
}

/**
 * Shared table treatment (C1/C2): sticky header, frozen first column, sortable
 * headers, right-aligned formatted numerics, zebra striping, a column-picker
 * for diagnostic fields, and optional expandable row details.
 */
export function DataTable<Row extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  sortBy,
  sortDir,
  onSortChange,
  renderDetail,
  columnPicker = false,
  maxHeight = 560,
  emptyMessage = 'No rows.',
}: DataTableProps<Row>) {
  const [visibleOverrides, setVisibleOverrides] = useState<Record<string, boolean>>({})
  const [localSortBy, setLocalSortBy] = useState<string | null>(null)
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const serverSorted = !!onSortChange
  const activeSortBy = serverSorted ? sortBy : (localSortBy ?? undefined)
  const activeSortDir = serverSorted ? (sortDir ?? 'desc') : localSortDir

  const visibleColumns = columns.filter((col) => visibleOverrides[col.key] ?? !col.defaultHidden)

  const sortedRows = useMemo(() => {
    if (serverSorted || !activeSortBy) return rows
    const sorted = [...rows].sort((a, b) => compareCells(a[activeSortBy], b[activeSortBy]))
    return activeSortDir === 'asc' ? sorted : sorted.reverse()
  }, [rows, serverSorted, activeSortBy, activeSortDir])

  const toggleSort = (key: string) => {
    const nextDir: 'asc' | 'desc' = activeSortBy === key && activeSortDir === 'desc' ? 'asc' : 'desc'
    if (serverSorted) onSortChange!(key, nextDir)
    else {
      setLocalSortBy(key)
      setLocalSortDir(nextDir)
    }
  }

  const numericClass = (col: DataTableColumn<Row>) =>
    col.format && col.format !== 'text' ? 'text-right tabular-nums' : ''

  return (
    <div className="space-y-2">
      {columnPicker ? (
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 max-h-80 overflow-auto space-y-2">
              {columns.map((col) => {
                const checked = visibleOverrides[col.key] ?? !col.defaultHidden
                return (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setVisibleOverrides((prev) => ({ ...prev, [col.key]: value === true }))
                      }
                    />
                    {col.label}
                  </label>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <div className="relative overflow-auto rounded-md border" style={{ maxHeight }}>
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow>
              {renderDetail ? <TableHead className="w-8 bg-card" /> : null}
              {visibleColumns.map((col, index) => (
                <TableHead
                  key={col.key}
                  onClick={col.sortable === false ? undefined : () => toggleSort(col.key)}
                  aria-sort={
                    activeSortBy === col.key ? (activeSortDir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn(
                    'bg-card text-xs whitespace-nowrap',
                    col.sortable === false ? '' : 'cursor-pointer select-none hover:text-foreground',
                    numericClass(col),
                    index === 0 && 'sticky left-0 z-10',
                    col.className
                  )}
                >
                  {col.label}
                  {activeSortBy === col.key ? (
                    <span aria-hidden className="ml-1 text-muted-foreground">
                      {activeSortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (renderDetail ? 1 : 0)}
                  className="text-sm text-muted-foreground py-6 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row, rowIndex) => {
                const key = rowKey(row)
                const zebra = rowIndex % 2 === 1
                const expanded = expandedKey === key
                return (
                  <Fragment key={key}>
                    <TableRow className={zebra ? 'bg-muted/40' : ''}>
                      {renderDetail ? (
                        <TableCell className="w-8 py-2.5">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground text-xs px-1"
                            onClick={() => setExpandedKey(expanded ? null : key)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Hide details' : 'Show details'}
                          >
                            {expanded ? '▾' : '▸'}
                          </button>
                        </TableCell>
                      ) : null}
                      {visibleColumns.map((col, index) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            'py-2.5 text-sm',
                            numericClass(col),
                            index === 0 && cn('sticky left-0 z-10 font-medium', zebra ? 'bg-muted' : 'bg-card'),
                            col.className
                          )}
                        >
                          {col.render ? col.render(row) : formatValue(row[col.key], col.format || 'text')}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderDetail && expanded ? (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={visibleColumns.length + 1} className="whitespace-normal">
                          {renderDetail(row)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </table>
      </div>
    </div>
  )
}
