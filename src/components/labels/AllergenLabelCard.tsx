'use client'

import React from 'react'
import { AlertCircle, Heart } from 'lucide-react'
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
}: {
  orderNumber: number
  labelIndex: number
  labelCount: number
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
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {orderNumber} ({labelIndex}/{labelCount})
        </span>
      </div>
      <div style={{ marginTop: 10, borderTop: `1px solid ${INK}` }} />
    </div>
  )
}

function AllergenProductTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: '12px 0 0',
        fontFamily: FONT_HERO,
        fontSize: 48,
        fontWeight: 400,
        lineHeight: 1,
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
        columnGap: 20,
        rowGap: 16,
        alignContent: 'start',
        marginTop: 14,
        paddingBottom: 8,
        overflow: 'hidden',
      }}
    >
      {components.map((component, idx) => {
        const Icon = pickComponentIcon(component.name, component.allergens)
        return (
          <div key={`${component.name}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <IconCircle Icon={Icon} size={42} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: 3,
                  wordBreak: 'break-word',
                }}
              >
                {component.name}
              </div>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: 1.3,
                  color: INK_LIGHT,
                  fontWeight: 500,
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
        borderTop: `1px dotted ${INK_MUTED}`,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <Heart size={18} strokeWidth={2.25} color={INK_MUTED} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
      <p
        style={{
          margin: 0,
          fontSize: 17,
          lineHeight: 1.35,
          color: INK_MUTED,
          fontFamily: FONT_BODY,
          fontWeight: 500,
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
      />
      <AllergenProductTitle title={data.productTitle} />
      <IngredientGrid components={data.components} />
      <DisclaimerFooter />
    </div>
  )
}
