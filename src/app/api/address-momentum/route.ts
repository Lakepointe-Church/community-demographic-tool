/**
 * GET /api/address-momentum?zip=75126
 *
 * HUD Aggregated USPS residential-address momentum for a ZIP (Phase 4.1).
 * "Address momentum" = trailing 4-quarter % change in active residential
 * addresses — the freshest available growth signal, ahead of ACS lag.
 *
 * Graceful degradation: returns { available: false } until the HUD data is
 * loaded (see scripts/import-hud-usps.ts — gated on a [HUMAN] HUD signup).
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_COUNTY } from '@/lib/zip-county'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  try {
    // Up to 8 quarters, oldest→newest, so the client can sparkline the trend.
    const rows = await sql`
      SELECT quarter, res_active, res_total, res_vacant, res_nostat
      FROM usps_addresses
      WHERE zip = ${zip} AND res_active IS NOT NULL
      ORDER BY quarter DESC
      LIMIT 8
    `

    if (rows.length === 0) {
      return NextResponse.json({ available: false, zip, county: ZIP_COUNTY[zip] ?? null })
    }

    const series = rows
      .map(r => ({ quarter: r.quarter as string, resActive: r.res_active as number }))
      .reverse() // oldest → newest

    const latest = series[series.length - 1]

    // Trailing 4-quarter % change: latest vs the quarter 4 back (needs ≥5 quarters).
    let momentumPct: number | null = null
    if (series.length >= 5) {
      const base = series[series.length - 5]
      if (base.resActive > 0) {
        momentumPct = parseFloat(
          (((latest.resActive - base.resActive) / base.resActive) * 100).toFixed(1)
        )
      }
    }

    // Simple prior-quarter % change as a fallback signal when <5 quarters exist.
    let qoqPct: number | null = null
    if (series.length >= 2) {
      const prior = series[series.length - 2]
      if (prior.resActive > 0) {
        qoqPct = parseFloat(
          (((latest.resActive - prior.resActive) / prior.resActive) * 100).toFixed(1)
        )
      }
    }

    return NextResponse.json({
      available: true,
      zip,
      county: ZIP_COUNTY[zip] ?? null,
      latestQuarter: latest.quarter,
      resActive: latest.resActive,
      momentumPct, // trailing 4-quarter
      qoqPct,      // quarter-over-quarter fallback
      series,
    })
  } catch (error) {
    console.error('Address momentum error:', error)
    return NextResponse.json({ error: 'Failed to load address momentum', details: String(error) }, { status: 500 })
  }
}
