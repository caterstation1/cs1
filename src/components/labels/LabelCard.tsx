'use client'

import React from 'react'

export interface LabelData {
  orderNumber: number
  labelIndex: number
  labelCount: number
  customerName: string
  company: string
  address: string
  deliveryWindow: string
  productTitle: string
  peopleText?: string
  meat1?: string
  meat2?: string
  option1?: string
  option2?: string
  serveware?: boolean
  addonsForOrder?: string
  notes?: string
  phonePrimary?: string
  phoneSecondary?: string
}

// Render to 732x1181 px (~300DPI for 62x100mm). Container should be captured to PNG.
export const LabelCard: React.FC<{ data: LabelData; landscape?: boolean }> = ({ data, landscape = false }) => {
  const W = landscape ? 1181 : 732
  const H = landscape ? 732 : 1181
  return (
    <div className="relative" style={{ width: W, height: H, background: '#ffffff', color: '#000', padding: 28, boxSizing: 'border-box', borderRadius: 18, border: '2px solid #00000020' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 44, fontWeight: 600 }}>
          {data.orderNumber} {data.customerName} ({data.labelIndex} / {data.labelCount})
        </div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{data.deliveryWindow}</div>
      </div>

      {/* Address */}
      <div style={{ marginTop: 24, fontSize: 30, lineHeight: 1.3 }}>
        {data.company && (<div>{data.company}</div>)}
        <div>{data.address}</div>
      </div>

      {/* Product title big */}
      <div style={{ marginTop: 48, textAlign: 'center', fontSize: 88, lineHeight: 1.05, fontWeight: 600 }}>
        {data.productTitle}
      </div>

      {/* Options block */}
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 32 }}>
        {data.peopleText && <div style={{ marginBottom: 6 }}>{data.peopleText}</div>}
        {(data.meat1 || data.meat2) && (
          <div>{[data.meat1, data.meat2].filter(Boolean).join(' / ')}</div>
        )}
        {(data.option1 || data.option2) && (
          <div>{[data.option1, data.option2].filter(Boolean).join('..')}</div>
        )}
        {data.serveware && (
          <div style={{ position: 'absolute', right: 28, top: 200, fontSize: 48, fontWeight: 700 }}>SW</div>
        )}
      </div>

      {/* Addons (first label only) */}
      {data.addonsForOrder && (
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 28 }}>
          Add-ons: {data.addonsForOrder}
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 88, fontSize: 24, lineHeight: 1.25 }}>
          {data.notes}
        </div>
      )}

      {/* Phones bottom right */}
      <div style={{ position: 'absolute', right: 28, bottom: 28, fontSize: 26 }}>
        {data.phonePrimary || 'Not provided'}
        {data.phoneSecondary ? `  ${data.phoneSecondary}` : ''}
      </div>
    </div>
  )
}


