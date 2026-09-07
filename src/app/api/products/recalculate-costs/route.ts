// Thin wrapper around the pricing engine's recalcAll.
//
// This route used to carry its own copy of the cost math, and it had three
// faults the engine fixes: it never repriced Components at all (only variants),
// it did one findUnique per ingredient per variant, and every failure path
// wrote 0 — so deleting a supplier row made margins improve. It also could not
// see ProduceCo.
//
// The response shape is unchanged so existing fire-and-forget callers keep
// working; `report` is additive.

import { NextResponse } from 'next/server';
import { recalcAll } from '@/lib/pricing/recalc';

export async function POST(request: Request) {
  try {
    // The old route accepted variantId/productId filters. A partial recalc is
    // no longer meaningful: components are shared, so repricing one variant
    // without its dependencies is how costs drifted in the first place.
    // The filter is accepted and ignored, and the caller is told why.
    let scopedRequest = false;
    try {
      const body = await request.json().catch(() => ({}));
      scopedRequest = Boolean(body?.variantId || body?.productId);
    } catch {}

    console.log('🔄 Starting cost recalculation via the pricing engine...');
    const report = await recalcAll('manual');

    const updated = report.components.updated + report.variants.updated;
    console.log(
      `✅ Recalc complete in ${report.durationMs}ms: ` +
        `${report.components.updated} component(s), ${report.variants.updated} variant(s) updated; ` +
        `coverage ${(report.coveragePct * 100).toFixed(1)}%`
    );
    for (const warning of report.warnings) console.warn(`⚠️  ${warning}`);

    return NextResponse.json({
      success: true,
      message: `Recalculated ${report.components.updated} component(s) and ${report.variants.updated} variant(s)`,
      updated,
      // Unresolved items are not errors — they are costs the engine refuses to
      // guess at. They keep their previous stored value.
      errors: 0,
      report: {
        runId: report.runId,
        durationMs: report.durationMs,
        components: report.components,
        variants: report.variants,
        coveragePct: report.coveragePct,
        unresolved: report.unresolved.length,
        cyclicComponentIds: report.cyclicComponentIds,
        warnings: report.warnings,
        ...(scopedRequest
          ? { note: 'variantId/productId filters are ignored: components are shared, so recalc is always whole-catalogue.' }
          : {}),
      },
    });
  } catch (error) {
    console.error('❌ Error in cost recalculation:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate product costs' },
      { status: 500 }
    );
  }
}
