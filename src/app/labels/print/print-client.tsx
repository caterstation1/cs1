'use client'

import { useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { LabelCard } from '@/components/labels/LabelCard'

type LabelData = any

export default function PrintLabelsClient({ date, orderIds }: { date: string; orderIds?: string }) {
  const [labels, setLabels] = useState<LabelData[]>([])
  const [renderIndex, setRenderIndex] = useState<number | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Loading labels…')
  const hiddenRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams()
        if (date) params.set('date', date)
        if (orderIds) params.set('orderIds', orderIds)
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
        }))
        setLabels(mapped)
        if (mapped.length > 0) setRenderIndex(0)
        else setError('No labels found for selected date')
      } catch (e: any) {
        setError(e?.message || 'Unknown error')
      }
    }
    run()
  }, [date, orderIds])

  useEffect(() => {
    if (renderIndex === null) return
    const el = hiddenRef.current
    if (!el) return
    const label = labels[renderIndex]
    if (!label) return

    const run = async () => {
      try {
        await new Promise((r) => setTimeout(r, 60))
        const { toPng } = await import('html-to-image')
        const dataUrl: string = await toPng(el, {
          pixelRatio: 2,
          quality: 1,
          backgroundColor: '#ffffff',
          skipFonts: true,
        })
        setImages((prev) => [...prev, dataUrl])
        if (renderIndex < labels.length - 1) setRenderIndex(renderIndex + 1)
        else {
          const pdf = new jsPDF({ unit: 'mm', format: [100, 62], orientation: 'landscape' })
          images.concat(dataUrl).forEach((img: string, idx: number) => {
            if (idx > 0) pdf.addPage([100, 62], 'landscape')
            pdf.addImage(img, 'PNG', 0, 0, 100, 62)
          })
          const blob = pdf.output('blob')
          const url = URL.createObjectURL(blob)
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
  }, [renderIndex])

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: 8, fontWeight: 700 }}>Preparing labels for {date || 'selected date'}...</div>
      {error ? <div style={{ color: 'red' }}>{error}</div> : <div style={{ color: '#444' }}>{status}</div>}
      <iframe ref={iframeRef} style={{ width: 0, height: 0, border: 0 }} />
      <div style={{ position: 'fixed', left: -9999, top: 0 }}>
        {renderIndex !== null && labels[renderIndex] && (
          <div ref={hiddenRef}>
            <LabelCard data={labels[renderIndex]} landscape />
          </div>
        )}
      </div>
    </div>
  )
}


