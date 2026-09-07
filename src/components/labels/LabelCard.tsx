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
  shippingAddress1?: string
  shippingAddress2?: string
  shippingCity?: string
  shippingProvince?: string
  shippingZip?: string
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
        margin: '10px 0 10px',
        color: INK_MUTED,
        fontSize: 18,
        letterSpacing: 4,
        userSelect: 'none',
      }}
    >
      <span style={{ flex: 1, maxWidth: 156, borderTop: `2px dotted ${INK_MUTED}` }} />
      <span style={{ fontSize: 14, lineHeight: 1 }}>◆</span>
      <span style={{ flex: 1, maxWidth: 156, borderTop: `2px dotted ${INK_MUTED}` }} />
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        position: 'relative',
        minHeight: 142,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 8, zIndex: 2 }}>
        <div
          style={{
            fontSize: 38,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {customerName}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: INK_MUTED,
            fontFamily: "'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
          }}
        >
          {orderNumber}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
          zIndex: 1,
          pointerEvents: 'none',
          width: 460,
          maxWidth: '56%',
          height: 128,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <CaterStationStamp size={345} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0, zIndex: 2 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginTop: 2, fontSize: 21, color: INK_MUTED, fontWeight: 700 }}>
            ({labelIndex}/{labelCount})
          </div>
          {deliveryTime ? (
            <div
              style={{
                fontFamily: FONT_HERO,
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                marginTop: 2,
              }}
            >
              {deliveryTime}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AddressBlock({
  company,
  address,
  shippingAddress1,
  shippingAddress2,
  shippingCity,
  shippingProvince,
  shippingZip,
}: {
  company: string
  address: string
  shippingAddress1?: string
  shippingAddress2?: string
  shippingCity?: string
  shippingProvince?: string
  shippingZip?: string
}) {
  const line2Parts = [shippingAddress1, shippingAddress2].filter(Boolean)
  const line3Parts = [shippingCity, shippingProvince, shippingZip].filter(Boolean)
  const hasStructured = line2Parts.length > 0 || line3Parts.length > 0
  if (!company && !address && !hasStructured) return null

  return (
    <div
      style={{
        marginTop: 8,
        paddingBottom: 8,
        borderBottom: `2px solid ${INK}`,
        fontSize: 24,
        lineHeight: 1.35,
        color: INK_MUTED,
        fontWeight: 550,
      }}
    >
      {company ? <div>{company}</div> : null}
      {hasStructured ? (
        <>
          {line2Parts.length > 0 ? <div>{line2Parts.join(', ')}</div> : null}
          {line3Parts.length > 0 ? <div>{line3Parts.join(', ')}</div> : null}
        </>
      ) : address ? (
        <div>{address}</div>
      ) : null}
    </div>
  )
}

function heroFontSize(title: string): number {
  const len = title.length
  const words = title.trim().split(/\s+/).length
  if (len > 72 || words >= 8) return 52
  if (len > 58 || words >= 7) return 58
  if (len > 44 || words >= 6) return 66
  if (len > 34 || words >= 5) return 72
  return 76
}

function heroLetterSpacing(title: string): string {
  const len = title.length
  if (len > 64) return '-0.018em'
  if (len > 48) return '-0.022em'
  return '-0.03em'
}

function heroLineHeight(title: string): number {
  const len = title.length
  if (len > 58) return 0.98
  if (len > 42) return 0.95
  return 0.92
}

function ProductHero({ title }: { title: string }) {
  const fontSize = heroFontSize(title)
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        // Increase top separation from address divider above product title.
        padding: `${fontSize}px 12px 4px`,
      }}
    >
      <h1
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: FONT_HERO,
          fontSize,
          fontWeight: 700,
          lineHeight: heroLineHeight(title),
          letterSpacing: heroLetterSpacing(title),
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
          maxWidth: '100%',
          textWrap: 'balance' as any,
        }}
      >
        {title}
      </h1>
    </div>
  )
}

function ProductSection({
  title,
}: {
  title: string
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ProductHero title={title} />
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
  const optionLine = [option1, option2].filter((value): value is string => Boolean(value))
  const lines: string[] = []
  if (variantLine) lines.push(variantLine)
  if (peopleText) lines.push(peopleText)
  lines.push(...optionLine)
  if (serveware) lines.push('Yes Serveware')
  else lines.push('No Serveware')
  if (addonsForOrder) lines.push(`Add-ons: ${addonsForOrder}`)

  if (lines.length === 0) return null

  return (
    <div style={{ textAlign: 'center', fontFamily: FONT_BODY, marginBottom: 4 }}>
      {lines.map((line, i) => (
        <div
          key={`${line}-${i}`}
          style={{
            fontSize: i === 0 && variantLine ? 26 : 24,
            lineHeight: 1.22,
            fontWeight: i === 0 && variantLine ? 700 : 600,
            color: i <= 1 ? INK : INK_MUTED,
            marginBottom: i < lines.length - 1 ? 2 : 0,
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
        paddingTop: 10,
        borderTop: `2px dotted ${INK_MUTED}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 20,
        minHeight: 42,
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 21,
          lineHeight: 1.25,
          color: INK_MUTED,
          fontStyle: 'normal',
          paddingRight: 12,
        }}
      >
        {notes || ''}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
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
      <AddressBlock
        company={data.company}
        address={data.address}
        shippingAddress1={data.shippingAddress1}
        shippingAddress2={data.shippingAddress2}
        shippingCity={data.shippingCity}
        shippingProvince={data.shippingProvince}
        shippingZip={data.shippingZip}
      />
      {data.serveware ? (
        <div
          style={{
            textAlign: 'right',
            fontSize: 52,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: INK,
            fontFamily: FONT_HERO,
            margin: '2px 2px 4px 0',
          }}
        >
          SW
        </div>
      ) : null}
      <ProductSection title={data.productTitle} />
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
