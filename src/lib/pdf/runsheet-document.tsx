import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  statBox: {
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  leftColumns: {
    flex: 4.2,
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 6,
    padding: 8,
  },
  columnWide: {
    flex: 1.3, // Cold kitchen wider
  },
  columnNarrow: {
    flex: 0.8, // Desserts narrower
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  itemQty: {
    width: 25,
    fontWeight: 'bold',
  },
  itemName: {
    flex: 1,
  },
  superscript: {
    fontSize: 7,
    color: '#666',
  },
  rightColumn: {
    flex: 0.72,
  },
  proteinBox: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  addonBox: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fde047',
    borderRadius: 6,
    padding: 8,
  },
  tomorrowSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#ccc',
  },
  tomorrowTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#7c3aed',
  },
})

interface RunsheetData {
  date: string
  orderCount: number
  boxesCount: number
  servewareBoxes: number
  productsList: Array<{ name: string; total: number; am: number }>
  addonsList: Array<{ name: string; total: number; am: number }>
  proteinsByInitial: Array<{ initial: string; total: number; am: number }>
  tasksByCategory: Record<string, { name: string; items: Record<string, { total: number; am: number }> }>
  nextDaySummary?: {
    bakery: { am: number; pm: number; total: number }
    prep: { am: number; pm: number; total: number }
    proteinsList: Array<{ initial: string; am: number; pm: number; total: number }>
    bakeryItems: Array<{ name: string; am: number; total: number }>
    prepItems: Array<{ name: string; am: number; total: number }>
  } | null
  nextDayDate?: string
}

export function RunsheetDocument({ data }: { data: RunsheetData }) {
  const renderItem = (qty: number, am: number, name: string) => (
    <View style={styles.item}>
      <Text style={styles.itemQty}>
        {qty}
        <Text style={styles.superscript}>{am}</Text>
      </Text>
      <Text style={styles.itemName}>{name}</Text>
    </View>
  )

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>RUNSHEET</Text>
          <Text style={styles.date}>{data.date}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>BOXES</Text>
            <Text style={styles.statValue}>{data.boxesCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ORDERS</Text>
            <Text style={styles.statValue}>{data.orderCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SERVEWARE</Text>
            <Text style={styles.statValue}>{data.servewareBoxes}</Text>
          </View>
        </View>

        {/* Main Grid */}
        <View style={styles.mainGrid}>
          {/* Left: 5 columns */}
          <View style={styles.leftColumns}>
            {/* Products */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>Products</Text>
              {data.productsList.map((p, idx) => (
                <View key={idx}>{renderItem(p.total, p.am, p.name)}</View>
              ))}
            </View>

            {/* Cold Kitchen */}
            <View style={[styles.column, styles.columnWide]}>
              <Text style={styles.columnHeader}>Cold kitchen</Text>
              {Object.entries(data.tasksByCategory['Cold kitchen']?.items || {}).map(([name, q]: [string, any]) => (
                <View key={name}>{renderItem(q.total, q.am, name)}</View>
              ))}
            </View>

            {/* Hot Kitchen */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>Hot kitchen</Text>
              {Object.entries(data.tasksByCategory['Hot kitchen']?.items || {}).map(([name, q]: [string, any]) => (
                <View key={name}>{renderItem(q.total, q.am, name)}</View>
              ))}
            </View>

            {/* Desserts */}
            <View style={[styles.column, styles.columnNarrow]}>
              <Text style={styles.columnHeader}>Desserts</Text>
              {Object.entries(data.tasksByCategory['Desserts']?.items || {}).map(([name, q]: [string, any]) => (
                <View key={name}>{renderItem(q.total, q.am, name)}</View>
              ))}
            </View>

            {/* Pre day prep */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>Pre day prep</Text>
              {Object.entries(data.tasksByCategory['Pre day prep']?.items || {}).map(([name, q]: [string, any]) => (
                <View key={name}>{renderItem(q.total, q.am, name)}</View>
              ))}
            </View>
          </View>

          {/* Right: Proteins & Addons */}
          <View style={styles.rightColumn}>
            <View style={styles.proteinBox}>
              <Text style={styles.columnHeader}>Proteins</Text>
              {data.proteinsByInitial.map((p) => (
                <View key={p.initial}>{renderItem(p.total, p.am, p.initial)}</View>
              ))}
            </View>

            <View style={styles.addonBox}>
              <Text style={styles.columnHeader}>Add-ons</Text>
              {data.addonsList.map((a) => (
                <View key={a.name}>{renderItem(a.total, a.am, a.name)}</View>
              ))}
            </View>
          </View>
        </View>

        {/* Next Day Summary */}
        {data.nextDaySummary && (
          <View style={styles.tomorrowSection}>
            <Text style={styles.tomorrowTitle}>Tomorrow: {data.nextDayDate}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.column}>
                <Text style={styles.columnHeader}>Proteins (AM/PM/Total)</Text>
                {data.nextDaySummary.proteinsList.map((p) => (
                  <Text key={p.initial} style={{ fontSize: 9, marginBottom: 3 }}>
                    {p.initial}: {p.am}/{p.pm}/{p.total}
                  </Text>
                ))}
              </View>
              <View style={styles.column}>
                <Text style={styles.columnHeader}>Bakery</Text>
                {data.nextDaySummary.bakeryItems.map((item) => (
                  <Text key={item.name} style={{ fontSize: 9, marginBottom: 3 }}>
                    {item.total} {item.name}
                  </Text>
                ))}
              </View>
              <View style={styles.column}>
                <Text style={styles.columnHeader}>Pre Prep</Text>
                {data.nextDaySummary.prepItems.map((item) => (
                  <Text key={item.name} style={{ fontSize: 9, marginBottom: 3 }}>
                    {item.total} {item.name}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}



