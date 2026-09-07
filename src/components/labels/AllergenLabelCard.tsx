'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { IconCircle, pickComponentIcon } from './label-icons'
import {
  FONT_BODY,
  FONT_HERO,
  INK,
  INK_LIGHT,
  INK_MUTED,
  labelDimensions,
  shellStyle,
} from './label-styles'

export interface AllergenLabelData {
  orderNumber: number
  labelIndex: number
  labelCount: number
  productTitle: string
  dietaryMarker?: string | null
  components: Array<{
    name: string
    allergens: string[]
  }>
}

const DISCLAIMER_TEXT =
  'Whilst we take upmost care with allergen safety - we are not certified as being allergen free and do process allergens within our kitchen. If you would like to speak to discuss please do not hesitate to call on 0800 300 653.'

function AllergenHeader({
  orderNumber,
  labelIndex,
  labelCount,
  dietaryMarker,
}: {
  orderNumber: number
  labelIndex: number
  labelCount: number
  dietaryMarker?: string | null
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={28} strokeWidth={2.5} color={INK} aria-hidden />
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Allergen detail label
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dietaryMarker ? (
            <span
              style={{
                border: `2px solid ${INK}`,
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '0.02em',
              }}
            >
              {dietaryMarker}
            </span>
          ) : null}
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {orderNumber} ({labelIndex}/{labelCount})
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10, borderTop: `2px solid ${INK}` }} />
    </div>
  )
}

function AllergenProductTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: '10px 0 0',
        fontFamily: FONT_HERO,
        fontSize: 46,
        fontWeight: 700,
        lineHeight: 0.98,
        letterSpacing: '-0.02em',
        textTransform: 'uppercase',
        wordBreak: 'break-word',
      }}
    >
      {title}
    </h2>
  )
}

function IngredientGrid({
  components,
}: {
  components: Array<{ name: string; allergens: string[] }>
}) {
  if (components.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          color: INK_MUTED,
          textAlign: 'center',
          padding: '24px 16px',
        }}
      >
        No component allergen flags found.
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap: 16,
        rowGap: 12,
        alignContent: 'start',
        marginTop: 12,
        paddingBottom: 8,
        overflow: 'hidden',
      }}
    >
      {components.map((component, idx) => {
        const Icon = pickComponentIcon(component.name, component.allergens)
        return (
          <div
            key={`${component.name}-${idx}`}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              borderTop: `2px solid ${INK}`,
              borderBottom: `2px solid ${INK_LIGHT}`,
              borderLeft: `1.5px solid ${INK_LIGHT}`,
              borderRight: `1.5px solid ${INK_LIGHT}`,
              borderRadius: 8,
              padding: '10px 10px',
              minHeight: 82,
            }}
          >
            <IconCircle Icon={Icon} size={38} />
            <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  marginBottom: 3,
                  wordBreak: 'break-word',
                }}
              >
                {component.name}
              </div>
              <div
                style={{
                  fontSize: 17,
                  lineHeight: 1.3,
                  color: '#111111',
                  fontWeight: 600,
                }}
              >
                {component.allergens.length > 0
                  ? component.allergens.join(' · ')
                  : '—'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DisclaimerFooter() {
  return (
    <div
      style={{
        marginTop: 'auto',
        paddingTop: 10,
        borderTop: `2px solid ${INK_MUTED}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.35,
          color: '#2f2f2f',
          fontFamily: FONT_BODY,
          fontWeight: 600,
        }}
      >
        {DISCLAIMER_TEXT}
      </p>
    </div>
  )
}

export const AllergenLabelCard: React.FC<{ data: AllergenLabelData; landscape?: boolean }> = ({
  data,
  landscape = false,
}) => {
  const { w, h } = labelDimensions(landscape)

  return (
    <div style={{ ...shellStyle(w, h), display: 'flex', flexDirection: 'column' }}>
      <AllergenHeader
        orderNumber={data.orderNumber}
        labelIndex={data.labelIndex}
        labelCount={data.labelCount}
        dietaryMarker={data.dietaryMarker}
      />
      <AllergenProductTitle title={data.productTitle} />
      <IngredientGrid components={data.components} />
      <DisclaimerFooter />
    </div>
  )
}
