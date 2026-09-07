'use client'

import { LabelCard, type LabelData } from '@/components/labels/LabelCard'
import { AllergenLabelCard } from '@/components/labels/AllergenLabelCard'

const SAMPLE_PRIMARY: LabelData = {
  orderNumber: 12639,
  labelIndex: 1,
  labelCount: 2,
  customerName: 'Nick Marwah',
  company: "Armstrong's - East Auckland Mazda",
  address: '279 Ti Rakau Drive, Pakuranga, Auckland 2013',
  deliveryWindow: '12:30 PM - 12:45 PM',
  productTitle: 'Chipotle Burrito Bowl Station',
  peopleText: 'Serves 12',
  meat1: 'Chipotle Chicken (GF DF)',
  option1: 'Extra salsa',
  serveware: true,
  addonsForOrder: 'Guacamole, Corn chips',
  notes: 'Leave at reception if no answer',
  phonePrimary: '021 555 1234',
}

const SAMPLE_ALLERGEN = {
  orderNumber: 12639,
  labelIndex: 1,
  labelCount: 2,
  productTitle: 'Chipotle Burrito Bowl Station',
  components: [
    { name: 'Burrito Rice', allergens: ['Vegan'] },
    { name: 'Grated Cheese', allergens: ['Contains Dairy', 'Vegetarian'] },
    { name: 'Tortilla Wraps', allergens: ['Contains Gluten'] },
    { name: 'Chipotle Chicken', allergens: ['Contains Soy'] },
  ],
}

export default function LabelsPreviewPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Label preview</h1>
        <p style={{ color: '#555', marginBottom: 20, fontSize: 14 }}>
          Sample data at print scale (100×62mm landscape). For live orders use{' '}
          <code>/labels/print?date=YYYY-MM-DD</code> with the dev server running.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Primary fulfilment label</h2>
            <div style={{ overflow: 'auto', border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 16 }}>
              <LabelCard data={SAMPLE_PRIMARY} landscape />
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Allergen detail label</h2>
            <div style={{ overflow: 'auto', border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 16 }}>
              <AllergenLabelCard data={SAMPLE_ALLERGEN} landscape />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
