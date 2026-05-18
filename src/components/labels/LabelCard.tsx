'use client'

import React from 'react'
import { CaterStationStamp } from './CaterStationStamp'
import {
  FONT_BODY,
  FONT_HERO,
  INK,
  INK_MUTED,
  formatDeliveryTime,
  labelDimensions,
  shellStyle,
} from './label-styles'

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
  secondary?: {
    productTitle: string
    components: Array<{ name: string; allergens: string[] }>
  }
}

function DecorativeDivider() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        margin: '14px 0 12px',
        color: INK_MUTED,
        fontSize: 18,
        letterSpacing: 4,
        userSelect: 'none',
      }}
    >
      <span style={{ flex: 1, maxWidth: 140, borderTop: `1px dotted ${INK_MUTED}` }} />
      <span style={{ fontSize: 14, lineHeight: 1 }}>♡</span>
      <span style={{ flex: 1, maxWidth: 140, borderTop: `1px dotted ${INK_MUTED}` }} />
    </div>
  )
}

function HeaderBar({
  orderNumber,
  customerName,
  labelIndex,
  labelCount,
  deliveryTime,
}: {
  orderNumber: number
  customerName: string
  labelIndex: number
  labelCount: number
  deliveryTime: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {orderNumber} {customerName}
        </div>
        <div style={{ marginTop: 4, fontSize: 22, color: INK_MUTED, fontWeight: 500 }}>
          ({labelIndex}/{labelCount})
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
        {deliveryTime ? (
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              paddingTop: 4,
            }}
          >
            {deliveryTime}
          </div>
        ) : null}
        <CaterStationStamp size={50} />
      </div>
    </div>
  )
}

function AddressBlock({ company, address }: { company: string; address: string }) {
  if (!company && !address) return null
  return (
    <div
      style={{
        marginTop: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${INK}`,
        fontSize: 22,
        lineHeight: 1.35,
        color: INK_MUTED,
        fontWeight: 500,
      }}
    >
      {company ? <div>{company}</div> : null}
      {address ? <div>{address}</div> : null}
    </div>
  )
}

function heroFontSize(title: string): number {
  const len = title.length
  if (len > 55) return 52
  if (len > 40) return 64
  if (len > 28) return 74
  return 82
}

function ProductHero({ title }: { title: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        padding: '8px 12px',
      }}
    >
      <h1
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: FONT_HERO,
          fontSize: heroFontSize(title),
          fontWeight: 400,
          lineHeight: 0.92,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
          wordBreak: 'break-word',
          maxWidth: '100%',
        }}
      >
        {title}
      </h1>
    </div>
  )
}

function OptionsBlock({
  peopleText,
  meat1,
  meat2,
  option1,
  option2,
  serveware,
  addonsForOrder,
}: Pick<
  LabelData,
  'peopleText' | 'meat1' | 'meat2' | 'option1' | 'option2' | 'serveware' | 'addonsForOrder'
>) {
  const variantLine = [meat1, meat2].filter(Boolean).join(' · ')
  const optionLine = [option1, option2].filter(Boolean).join(' · ')
  const lines: string[] = []
  if (peopleText) lines.push(peopleText)
  if (variantLine) lines.push(variantLine)
  if (optionLine) lines.push(optionLine)
  if (serveware) lines.push('Yes Serveware')
  if (addonsForOrder) lines.push(`Add-ons: ${addonsForOrder}`)

  if (lines.length === 0) return null

  return (
    <div style={{ textAlign: 'center', fontFamily: FONT_BODY }}>
      {lines.map((line, i) => (
        <div
          key={`${line}-${i}`}
          style={{
            fontSize: 26,
            lineHeight: 1.35,
            fontWeight: i === 0 && variantLine ? 600 : 500,
            color: i === 0 ? INK : INK_MUTED,
            marginBottom: i < lines.length - 1 ? 4 : 0,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

function FooterMeta({
  notes,
  phonePrimary,
  phoneSecondary,
}: {
  notes?: string
  phonePrimary?: string
  phoneSecondary?: string
}) {
  const phone = [phonePrimary, phoneSecondary].filter(Boolean).join('  ') || 'Not provided'
  return (
    <div
      style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: `1px dotted ${INK_MUTED}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 20,
        minHeight: 52,
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 22,
          lineHeight: 1.3,
          color: INK_MUTED,
          fontStyle: notes ? 'italic' : 'normal',
          paddingRight: 12,
        }}
      >
        {notes || ''}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
        {phone}
      </div>
    </div>
  )
}

export const LabelCard: React.FC<{ data: LabelData; landscape?: boolean }> = ({
  data,
  landscape = false,
}) => {
  const { w, h } = labelDimensions(landscape)
  const deliveryTime = formatDeliveryTime(data.deliveryWindow)

  return (
    <div style={{ ...shellStyle(w, h), display: 'flex', flexDirection: 'column' }}>
      <HeaderBar
        orderNumber={data.orderNumber}
        customerName={data.customerName}
        labelIndex={data.labelIndex}
        labelCount={data.labelCount}
        deliveryTime={deliveryTime}
      />
      <AddressBlock company={data.company} address={data.address} />
      <ProductHero title={data.productTitle} />
      <DecorativeDivider />
      <OptionsBlock
        peopleText={data.peopleText}
        meat1={data.meat1}
        meat2={data.meat2}
        option1={data.option1}
        option2={data.option2}
        serveware={data.serveware}
        addonsForOrder={data.addonsForOrder}
      />
      <FooterMeta
        notes={data.notes}
        phonePrimary={data.phonePrimary}
        phoneSecondary={data.phoneSecondary}
      />
    </div>
  )
}
