'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { LabelCard, type LabelData } from '@/components/labels/LabelCard'

interface LabelsResponse { date: string; count: number; labels: any[] }

export function LabelsPanel({ initialDate, auto }: { initialDate?: string; auto?: boolean }) {
  const [date, setDate] = useState<string>(initialDate || '')
  const [labels, setLabels] = useState<LabelData[]>([])
  const [loading, setLoading] = useState(false)
  const hiddenRef = useRef<HTMLDivElement>(null)

  const fetchLabels = async () => {
    if (!date) return
    setLoading(true)
    try {
      const res = await fetch(`/api/labels?date=${encodeURIComponent(date)}`)
      const json: LabelsResponse = await res.json()
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
    } finally { setLoading(false) }
  }

  const exportCSV = () => {
    const cols = ['order_number','label_index','label_count','customer_name','company','address','delivery_window','phone_primary','phone_secondary','product_title','people_text','meat1','meat2','option1','option2','serveware','addons_for_order','notes']
    const rows = labels.map(l => [l.orderNumber,l.labelIndex,l.labelCount,l.customerName,l.company,l.address,l.deliveryWindow,l.phonePrimary||'',l.phoneSecondary||'',l.productTitle,l.peopleText||'',l.meat1||'',l.meat2||'',l.option1||'',l.option2||'',l.serveware?'yes':'',l.addonsForOrder||'',(l.notes||'').replace(/\n/g,' ')])
    const csv = [cols.join(','), ...rows.map(r=> r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `labels_${date}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const downloadPDF = async () => {
    if (!labels.length) return
    // 62x100 mm landscape
    const pdf = new jsPDF({ unit: 'mm', format: [100, 62], orientation: 'landscape' })
    for (let i = 0; i < labels.length; i++) {
      const node = document.createElement('div')
      hiddenRef.current?.appendChild(node)
      const mount = document.createElement('div')
      node.appendChild(mount)
      // Render LabelCard via React portal-like approach
      // Instead, we render via ReactDOM in client; but to keep simple here, use a container component already on page.
    }
  }

  // Simpler approach: render one hidden LabelCard and capture sequentially by updating state
  const [renderIndex, setRenderIndex] = useState<number | null>(null)
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    const run = async () => {
      if (renderIndex === null) return
      const card = hiddenRef.current?.firstElementChild as HTMLElement
      if (!card) return
      const dataUrl = await toPng(card, { pixelRatio: 2 })
      setImages(prev => [...prev, dataUrl])
      if (renderIndex < labels.length - 1) {
        setRenderIndex(renderIndex + 1)
      } else {
        // build PDF
        const pdf = new jsPDF({ unit: 'mm', format: [100, 62], orientation: 'landscape' })
        images.concat(dataUrl).forEach((img, idx) => {
          if (idx > 0) pdf.addPage([100, 62], 'landscape')
          pdf.addImage(img, 'PNG', 0, 0, 100, 62)
        })
        pdf.save(`labels_${date}.pdf`)
        setRenderIndex(null)
        setImages([])
      }
    }
    void run()
  }, [renderIndex])

  // Listen to global 'labels-print' events to one-click print current selection
  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.detail?.date as string | undefined
      if (d) {
        setDate(d)
        ;(async () => { await fetchLabels(); setRenderIndex(0) })()
      }
    }
    window.addEventListener('labels-print', handler)
    return () => window.removeEventListener('labels-print', handler)
  }, [])

  // If auto and initialDate provided, load immediately
  useEffect(() => {
    if (auto && date) fetchLabels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-2 py-1" />
        <button onClick={fetchLabels} className="px-3 py-1 border rounded">Load</button>
        <div className="text-sm text-gray-600">{loading ? 'Loading…' : labels.length ? `${labels.length} labels` : ''}</div>
        <div className="flex-1" />
        <button onClick={exportCSV} disabled={!labels.length} className="px-3 py-1 border rounded disabled:opacity-50">Export CSV</button>
        <button onClick={()=> setRenderIndex(0)} disabled={!labels.length} className="px-3 py-1 border rounded disabled:opacity-50">Download PDF</button>
      </div>

      {/* Hidden renderer */}
      <div ref={hiddenRef} style={{ position:'absolute', left: -10000, top: 0 }}>
        {renderIndex !== null && labels[renderIndex] && (
          <LabelCard data={labels[renderIndex]} landscape />
        )}
      </div>
    </div>
  )
}


