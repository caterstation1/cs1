'use client'

import React from 'react'
import { INK } from './label-styles'

/** Small circular stamp mark — fashion-label treatment, top-right corner */
export function CaterStationStamp({ size = 52 }: { size?: number }) {
  const fontSize = Math.round(size * 0.17)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.5px solid ${INK}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: '#fff',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r="24" fill="none" stroke={INK} strokeWidth="1.5" />
        <text
          x="26"
          y="22"
          textAnchor="middle"
          fill={INK}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="Impact, 'Arial Black', sans-serif"
          letterSpacing="0.08em"
        >
          CS
        </text>
        <text
          x="26"
          y="34"
          textAnchor="middle"
          fill={INK}
          fontSize={fontSize * 0.55}
          fontWeight="600"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          letterSpacing="0.12em"
        >
          STATION
        </text>
      </svg>
    </div>
  )
}
