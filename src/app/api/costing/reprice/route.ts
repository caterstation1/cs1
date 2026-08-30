import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { recalcAll } from '@/lib/pricing/recalc'

// Pushes option edits through to every variant's stored cost. Separate from
// saving so editing stays instant; the costing screen nags when one is due.

export const maxDuration = 300

export async function POST() {
  try {
    try {
      await requireRole(['owner', 'admin'])
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const report = await recalcAll('costing-options')
    return NextResponse.json({
      runId: report.runId,
      durationMs: report.durationMs,
      variantsUpdated: report.variants.updated,
      componentsUpdated: report.components.updated,
      coveragePct: Math.round(report.coveragePct * 100),
      unresolvedVariants: report.variants.unresolved,
    })
  } catch (e) {
    console.error('❌ costing reprice error:', e)
    return NextResponse.json({ error: 'Reprice failed' }, { status: 500 })
  }
}
