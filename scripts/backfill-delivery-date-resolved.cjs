#!/usr/bin/env node
/* Backfill deliveryDateResolved for existing orders in batches */
// Use Prisma generated client directly from src/generated/prisma
const { PrismaClient } = require('../src/generated/prisma')
const prisma = new PrismaClient()

async function main() {
  const BATCH = parseInt(process.env.BATCH || '1000', 10)
  const DRY_RUN = process.env.DRY_RUN === '1'
  let offset = 0
  let updated = 0

  console.log('Starting backfill for deliveryDateResolved', { BATCH, DRY_RUN })

  function parseLocalDate(str) {
    if (!str || typeof str !== 'string') return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number)
      return new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    const ts = Date.parse(str)
    if (!Number.isNaN(ts)) {
      const dt = new Date(ts)
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0)
    }
    const m = str.match(/\b(\d{1,2})[\/](\d{1,2})[\/]((?:19|20)\d{2})\b/)
    if (m) {
      const [, dd, mm, yyyy] = m
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0, 0)
    }
    return null
  }

  function nzDayUtcFrom(date) {
    const nzStr = date.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' })
    const [dd, mm, yyyy] = nzStr.split('/').map(Number)
    return new Date(Date.UTC(yyyy, mm - 1, dd))
  }

  function resolve(order) {
    if (order && order.deliveryDate) {
      const d = parseLocalDate(order.deliveryDate)
      if (d) return { date: d, source: 'FIELD' }
    }
    const noteAttrs = order?.noteAttributes
    if (noteAttrs) {
      if (Array.isArray(noteAttrs)) {
        const attr = noteAttrs.find(a => a && typeof a.name === 'string' && a.name.toLowerCase().includes('delivery date'))
        const d = parseLocalDate(attr && attr.value)
        if (d) return { date: d, source: 'NOTE' }
      } else if (typeof noteAttrs === 'object') {
        const key = Object.keys(noteAttrs).find(k => k.toLowerCase().includes('delivery date'))
        if (key) {
          const d = parseLocalDate(noteAttrs[key])
          if (d) return { date: d, source: 'NOTE' }
        }
      }
    }
    if (typeof order?.tags === 'string' && order.tags.trim().length > 0) {
      const parts = order.tags.split(',').map(s => s.trim())
      for (const p of parts) {
        const d = parseLocalDate(p)
        if (d) return { date: d, source: 'TAG' }
      }
    }
    const created = order?.createdAt ? new Date(order.createdAt) : new Date()
    return { date: nzDayUtcFrom(created), source: 'CREATED_AT' }
  }

  while (true) {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      skip: offset,
      select: {
        id: true,
        createdAt: true,
        deliveryDate: true,
        noteAttributes: true,
        tags: true,
        deliveryDateResolved: true,
      }
    })
    if (orders.length === 0) break

    for (const o of orders) {
      if (o.deliveryDateResolved) continue
      const resolved = resolve({
        deliveryDate: o.deliveryDate,
        noteAttributes: o.noteAttributes,
        tags: o.tags,
        createdAt: o.createdAt,
      })
      if (!DRY_RUN) {
        await prisma.order.update({
          where: { id: o.id },
          data: {
            deliveryDateResolved: resolved.date,
            deliveryDateResolvedSource: resolved.source,
            deliveryDateResolvedAt: new Date(),
          }
        })
      }
      updated++
      if (updated % 500 === 0) console.log('Updated', updated)
    }

    offset += orders.length
    if (orders.length < BATCH) break
  }
  console.log('Backfill complete. Updated:', updated)
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })


