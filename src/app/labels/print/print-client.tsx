'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { LabelCard } from '@/components/labels/LabelCard'
import { AllergenLabelCard } from '@/components/labels/AllergenLabelCard'

type LabelData = any
type RenderJob =
  | { kind: 'primary'; data: LabelData }
  | {
      kind: 'secondary'
      data: {
        orderNumber: number
        labelIndex: number
        labelCount: number
        productTitle: string
        components: Array<{ name: string; allergens: string[] }>
        dietaryMarker?: string | null
      }
    }

const buildLabelKey = (orderNumber: number, labelIndex: number, productTitle: string) =>
  `${orderNumber}|${labelIndex}|${String(productTitle || '').trim().toLowerCase()}`

export default function PrintLabelsClient({
  date,
  orderIds,
  labelKeys,
  orderNumber,
}: {
  date: string
  orderIds?: string
  labelKeys?: string
  orderNumber?: string
}) {
  const [labels, setLabels] = useState<LabelData[]>([])
  const [renderIndex, setRenderIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Loading labels…')
  const hiddenRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pdfRef = useRef<jsPDF | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const selectedLabelKeySet = useMemo(() => {
    const keys = String(labelKeys || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    return new Set(keys)
  }, [labelKeys])

  useEffect(() => {
    const run = async () => {
      try {
        let resolvedDate = date
        let resolvedOrderIds = orderIds

        if (orderNumber && !date) {
          setStatus(`Looking up order #${orderNumber}…`)
          const lookup = await fetch(`/api/labels/resolve-order?orderNumber=${encodeURIComponent(orderNumber)}`)
          const lookupJson = await lookup.json()
          if (!lookup.ok) throw new Error(lookupJson?.error || 'Order not found')
          resolvedDate = lookupJson.date
          resolvedOrderIds = lookupJson.orderId
        }

        if (!resolvedDate) throw new Error('Missing delivery date for labels')

        const params = new URLSearchParams()
        params.set('date', resolvedDate)
        if (resolvedOrderIds) params.set('orderIds', resolvedOrderIds)
        const res = await fetch(`/api/labels?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load labels')
        const json = await res.json()
        const mapped: LabelData[] = (json.labels || []).map((l: any) => ({
          orderNumber: l.orderNumber,
          labelIndex: l.labelIndex,
          labelCount: l.labelCount,
          customerName: l.customerName,
          company: l.company,
          address: l.address,
          shippingAddress1: l.shippingAddress1,
          shippingAddress2: l.shippingAddress2,
          shippingCity: l.shippingCity,
          shippingProvince: l.shippingProvince,
          shippingZip: l.shippingZip,
          deliveryWindow: l.deliveryWindow,
          productTitle: l.productTitle,
          peopleText: l.peopleText,
          meat1: l.meat1,
          meat2: l.meat2,
          option1: l.option1,
          option2: l.option2,
          serveware: l.serveware,
          addonsForOrder: l.addonsForOrder,
          notes: l.notes,
          phonePrimary: l.phonePrimary,
          phoneSecondary: l.phoneSecondary,
          secondary: l.secondary,
        }))
        const filtered =
          selectedLabelKeySet.size === 0
            ? mapped
            : mapped.filter((label) =>
                selectedLabelKeySet.has(
                  buildLabelKey(
                    Number(label.orderNumber || 0),
                    Number(label.labelIndex || 0),
                    String(label.productTitle || '')
                  )
                )
              )

        setLabels(filtered)
        if (filtered.length > 0) {
          // Build PDF incrementally to avoid very large in-memory image arrays.
          pdfRef.current = new jsPDF({ unit: 'mm', format: [100, 62], orientation: 'landscape' })
          setStatus(`Preparing labels for ${resolvedDate || 'selected date'}... (1/${filtered.length})`)
          setRenderIndex(0)
        } else setError('No labels found for selected date')
      } catch (e: any) {
        setError(e?.message || 'Unknown error')
      }
    }
    run()
  }, [date, orderIds, orderNumber, selectedLabelKeySet])

  const renderJobs: RenderJob[] = labels.flatMap((label) => {
    const secondary = label.secondary
    if (!secondary) return [{ kind: 'primary', data: label }]
    return [
      { kind: 'primary', data: label },
      {
        kind: 'secondary',
        data: {
          orderNumber: label.orderNumber,
          labelIndex: label.labelIndex,
          labelCount: label.labelCount,
          productTitle: secondary.productTitle || label.productTitle || '',
          components: Array.isArray(secondary.components) ? secondary.components : [],
          dietaryMarker: secondary.dietaryMarker || null,
        },
      },
    ]
  })

  useEffect(() => {
    if (renderIndex === null) return
    const el = hiddenRef.current
    if (!el) return
    const job = renderJobs[renderIndex]
    if (!job) return

    const run = async () => {
      try {
        await new Promise((r) => setTimeout(r, 60))
        const { toPng } = await import('html-to-image')
        const dataUrl: string = await toPng(el, {
          pixelRatio: 1.5,
          quality: 1,
          backgroundColor: '#ffffff',
          skipFonts: true,
        })
        const pdf = pdfRef.current
        if (!pdf) throw new Error('Label PDF session not initialized')

        if (renderIndex > 0) pdf.addPage([100, 62], 'landscape')
        pdf.addImage(dataUrl, 'PNG', 0, 0, 100, 62, undefined, 'FAST')

        if (renderIndex < renderJobs.length - 1) {
          setStatus(`Preparing labels for ${date || 'selected date'}... (${renderIndex + 2}/${renderJobs.length})`)
          setRenderIndex(renderIndex + 1)
        } else {
          const blob = pdf.output('blob')
          if (!(blob instanceof Blob)) throw new Error('Could not create labels PDF blob')
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setStatus('Opening print dialog…')

          // Ensure we only close after print completes
          const after = () => setTimeout(() => window.close(), 500)
          window.addEventListener('afterprint', after, { once: true })

          // Use a hidden iframe to trigger the browser PDF viewer
          let iframe = iframeRef.current
          if (!iframe) {
            iframe = document.createElement('iframe')
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            document.body.appendChild(iframe)
          }
          
          const onLoad = () => {
            setTimeout(() => {
              try {
                // Try multiple approaches to trigger print
                if (iframe?.contentWindow) {
                  iframe.contentWindow.focus()
                  
                  // Method 1: Direct print call
                  iframe.contentWindow.print()
                  
                  // Method 2: If that doesn't work, try with a small delay
                  setTimeout(() => {
                    try {
                      iframe?.contentWindow?.print()
                    } catch (e) {
                      console.log('Second print attempt failed:', e)
                    }
                  }, 500)
                  
                  // Method 3: If still no print dialog, open in new tab
                  setTimeout(() => {
                    try {
                      window.open(url, '_blank')
                    } catch (e) {
                      console.log('Fallback to new tab failed:', e)
                    }
                  }, 2000)
                }
              } catch (e) {
                console.error('Print attempt failed:', e)
                // Fallback: open a tab for manual print
                window.open(url, '_blank')
              }
            }, 400)
          }
          
          iframe.addEventListener('load', onLoad, { once: true } as any)
          iframe.src = url
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to render label')
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderIndex, renderJobs.length, date])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: 8, fontWeight: 700 }}>Preparing labels for {date || 'selected date'}...</div>
      {error ? <div style={{ color: 'red' }}>{error}</div> : <div style={{ color: '#444' }}>{status}</div>}
      <iframe ref={iframeRef} style={{ width: 0, height: 0, border: 0 }} />
      <div style={{ position: 'fixed', left: -9999, top: 0 }}>
        {renderIndex !== null && renderJobs[renderIndex] && (
          <div ref={hiddenRef}>
            {renderJobs[renderIndex].kind === 'primary' ? (
              <LabelCard data={renderJobs[renderIndex].data} landscape />
            ) : (
              <AllergenLabelCard data={renderJobs[renderIndex].data} landscape />
            )}
          </div>
        )}
      </div>
    </div>
  )
}


