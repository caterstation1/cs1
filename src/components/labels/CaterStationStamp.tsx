'use client'

import React from 'react'

/** Standalone monochrome CaterStation logo mark */
export function CaterStationStamp({ size = 66 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <img
        src="/caterstationlabellogo.svg"
        alt="CaterStation"
        style={{
          width: Math.round(size * 0.95),
          height: Math.round(size * 0.95),
          objectFit: 'contain',
          objectPosition: 'top center',
          // Source SVG has large top whitespace in its internal viewBox.
          // Shift image up so visible mark sits near the physical top print area.
          transform: 'translateY(-30%)',
          filter: 'grayscale(1) contrast(1.25)',
        }}
      />
    </div>
  )
}
