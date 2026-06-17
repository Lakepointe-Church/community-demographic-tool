/**
 * GET /api/school-enrollment?zip=75087
 *
 * ZIP-level public-school enrollment from NCES CCD (Phase 4.3): per-year totals +
 * campus count, plus the earliest→latest CAGR that feeds the Site Scorer's
 * enrollment signal. Graceful: { available: false } when the ZIP has no school
 * rows (no CCD-listed public schools, or the importer hasn't been run yet).
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { enrollmentCagrScore } from '@/lib/scoring'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  try {
    const rows = await sql`
      SELECT year, enrollment, campus_count
      FROM zip_school_enrollment WHERE zip = ${zip} ORDER BY year ASC
    `
    if (!rows.length) return NextResponse.json({ available: false, zip })

    const series = rows.map(r => ({
      year: r.year as number,
      enrollment: r.enrollment as number,
      campusCount: r.campus_count as number,
    }))
    const first = series[0]
    const last = series[series.length - 1]
    const years = last.year - first.year
    const cagrScore = years > 0 ? enrollmentCagrScore(first.enrollment, last.enrollment, years) : null
    const cagrPct = years > 0 && first.enrollment > 0
      ? parseFloat(((Math.pow(last.enrollment / first.enrollment, 1 / years) - 1) * 100).toFixed(2))
      : null

    return NextResponse.json({
      available: true,
      zip,
      series,
      latestYear: last.year,
      latestEnrollment: last.enrollment,
      campusCount: last.campusCount,
      cagrPct,
      cagrScore,
    })
  } catch (error) {
    console.error('school-enrollment error:', error)
    return NextResponse.json({ error: 'Failed to load school enrollment', details: String(error) }, { status: 500 })
  }
}
