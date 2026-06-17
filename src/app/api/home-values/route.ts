/**
 * GET /api/home-values?zip=75205
 *
 * Current home value signal from Zillow ZHVI (Phase 4.7):
 *   - zhvi:     typical home value for the ZIP (smoothed, seasonally adjusted), whole dollars
 *   - zhviYoy:  % change vs. 12 months prior (momentum; null when unavailable)
 *   - series:   trailing up-to-13 months [{month:'YYYY-MM', value}] for a sparkline
 *
 * Fresher than ACS B25077 (self-reported, ~2yr lag). Context tier — display only.
 * Graceful: { available: false } when the ZIP has no ZHVI row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  try {
    const rows = await sql`
      SELECT latest_month, zhvi, zhvi_yoy, series
      FROM zip_home_values WHERE zip = ${zip} LIMIT 1
    `
    const r = rows[0]
    if (!r || r.zhvi == null) return NextResponse.json({ available: false, zip })

    return NextResponse.json({
      available: true,
      zip,
      latestMonth: r.latest_month as string,
      zhvi: r.zhvi as number,
      zhviYoy: r.zhvi_yoy != null ? Number(r.zhvi_yoy) : null,
      series: (r.series as { month: string; value: number }[] | null) ?? [],
    })
  } catch (error) {
    console.error('Home values error:', error)
    return NextResponse.json({ error: 'Failed to load home values', details: String(error) }, { status: 500 })
  }
}
