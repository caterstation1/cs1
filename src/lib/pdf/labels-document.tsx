import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 0,
  },
  label: {
    width: '100mm',
    height: '62mm',
    padding: 8,
    border: '1px solid #000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  labelCount: {
    fontSize: 10,
    color: '#666',
  },
  customer: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  company: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 9,
    marginBottom: 2,
  },
  deliveryWindow: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  peopleText: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  meatsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  meatBox: {
    backgroundColor: '#fee',
    padding: 3,
    borderRadius: 2,
    fontSize: 10,
    fontWeight: 'bold',
  },
  addons: {
    fontSize: 9,
    color: '#b91c1c',
    marginTop: 2,
  },
  notes: {
    fontSize: 8,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  phone: {
    fontSize: 9,
    marginTop: 2,
  },
})

interface LabelData {
  orderNumber: string
  labelIndex: number
  labelCount: number
  customerName: string
  company?: string
  address: string[]
  deliveryWindow: string
  productTitle: string
  peopleText?: string
  meat1?: string
  meat2?: string
  option1?: string
  option2?: string
  serveware?: boolean
  addonsForOrder?: string[]
  notes?: string
  phonePrimary?: string
  phoneSecondary?: string
}

export function LabelsDocument({ labels }: { labels: LabelData[] }) {
  return (
    <Document>
      {labels.map((label, idx) => (
        <Page key={idx} size={[100 * 2.83465, 62 * 2.83465]} style={styles.page}>
          <View style={styles.label}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.orderNumber}>#{label.orderNumber}</Text>
              <Text style={styles.labelCount}>
                {label.labelIndex}/{label.labelCount}
              </Text>
            </View>

            {/* Customer */}
            <Text style={styles.customer}>{label.customerName}</Text>
            {label.company && <Text style={styles.company}>{label.company}</Text>}

            {/* Address */}
            {label.address.map((line, i) => (
              <Text key={i} style={styles.address}>{line}</Text>
            ))}

            {/* Delivery Window */}
            <Text style={styles.deliveryWindow}>{label.deliveryWindow}</Text>

            {/* Product */}
            <Text style={styles.productTitle}>{label.productTitle}</Text>
            {label.peopleText && <Text style={styles.peopleText}>{label.peopleText}</Text>}

            {/* Meats/Options */}
            <View style={styles.meatsRow}>
              {label.meat1 && <Text style={styles.meatBox}>{label.meat1}</Text>}
              {label.meat2 && <Text style={styles.meatBox}>{label.meat2}</Text>}
              {label.option1 && <Text style={{ fontSize: 9 }}>{label.option1}</Text>}
              {label.option2 && <Text style={{ fontSize: 9 }}>{label.option2}</Text>}
              {label.serveware && <Text style={{ fontSize: 9, fontWeight: 'bold' }}>SW</Text>}
            </View>

            {/* Addons */}
            {label.addonsForOrder && label.addonsForOrder.length > 0 && (
              <Text style={styles.addons}>+ {label.addonsForOrder.join(', ')}</Text>
            )}

            {/* Notes */}
            {label.notes && <Text style={styles.notes}>{label.notes}</Text>}

            {/* Phone */}
            {label.phonePrimary && (
              <Text style={styles.phone}>📞 {label.phonePrimary}</Text>
            )}
          </View>
        </Page>
      ))}
    </Document>
  )
}



