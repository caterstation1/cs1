// Nightly whole-catalogue reprice. 14:30 UTC ≈ 02:30 NZT.
//
// Supplier prices change without anyone saving a recipe, so without this the
// stored costs only move when someone happens to edit something.

import { NextRequest, NextResponse } from 'next/server'
import { recalcAll } from '@/lib/pricing/recalc'
import { evaluateAlerts } from '@/lib/pricing/alerts'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (process.env.CRON_SECRET && !isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔄 [pricing-recalc] Nightly recalculation starting')
    const report = await recalcAll('cron')
    const alerts = await evaluateAlerts()

    console.log(
      `✅ [pricing-recalc] ${report.components.updated} component(s), ${report.variants.updated} variant(s) ` +
        `updated in ${report.durationMs}ms; coverage ${(report.coveragePct * 100).toFixed(1)}%; ` +
        `alerts +${alerts.opened} / -${alerts.resolved}`
    )
    for (const warning of report.warnings) console.warn(`⚠️  [pricing-recalc] ${warning}`)

    return NextResponse.json({
      success: true,
      runId: report.runId,
      durationMs: report.durationMs,
      components: report.components,
      variants: report.variants,
      coveragePct: report.coveragePct,
      unresolved: report.unresolved.length,
      alerts,
      warnings: report.warnings,
    })
  } catch (error) {
    console.error('❌ [pricing-recalc] Failed:', error)
    return NextResponse.json(
      { error: 'Recalculation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
