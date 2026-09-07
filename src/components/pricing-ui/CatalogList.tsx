'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

/**
 * The left-hand catalogue panel, scrolling the whole list but mounting only the
 * rows near the viewport. Both pricing pages feed it over a thousand rows and
 * rebuild the list on every keystroke, so mounting all of it would be paid for
 * repeatedly. Rows are a fixed height, which is what lets the offsets be
 * arithmetic rather than measurement.
 */
export function CatalogList<T>({
  items,
  rowHeight,
  resetKey,
  keyOf,
  renderRow,
  empty,
}: {
  items: T[]
  rowHeight: number
  /** Scroll returns to the top when this changes — a new search or a new tab. */
  resetKey: string
  keyOf: (item: T) => string
  renderRow: (item: T) => ReactNode
  empty: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewport(el.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Without this a search that shortens the list leaves you parked past its
  // end, looking at nothing.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [resetKey])

  const overscan = 6
  const height = viewport || 600
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + overscan)
  const visible = items.slice(start, end)

  return (
    <div className="rb-catList" ref={scrollRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      {items.length ? (
        <div className="rb-catSizer" style={{ height: items.length * rowHeight }}>
          {visible.map((item, i) => (
            <div
              key={keyOf(item)}
              className="rb-catRow"
              style={{ top: (start + i) * rowHeight, height: rowHeight }}
            >
              {renderRow(item)}
            </div>
          ))}
        </div>
      ) : (
        <div className="rb-more">{empty}</div>
      )}
    </div>
  )
}
