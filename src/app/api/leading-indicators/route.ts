/**
 * GET /api/leading-indicators?zip=75002
 *
 * Returns county-level Phase 5 leading indicator data for a given ZIP:
 *   - Building permits (BPS, 3 years of trend)
 *   - School district enrollment (TEA PEIMS, 5 years of trend)
 *   - County population projections (TDC Vintage 2024)
 *
 * All data is county-level — mapped from ZIP via zip-county.ts.
 * If a data source hasn't been loaded yet, that field returns null (graceful degradation).
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_COUNTY } from '@/lib/zip-county'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  const county = ZIP_COUNTY[zip]
  if (!county) return NextResponse.json({ error: `No county mapping for ZIP ${zip}` }, { status: 404 })

  try {
    const [permitRows, enrollmentRows, projectionRows] = await Promise.all([
      sql`
        SELECT year, sf_permits, mf_permits, total_permits
        FROM county_permits
        WHERE county = ${county}
        ORDER BY year DESC
        LIMIT 5
      `,
      sql`
        SELECT year, SUM(enrollment)::int AS total_enrollment
        FROM isd_enrollment
        WHERE county = ${county}
        GROUP BY year
        ORDER BY year ASC
      `,
      sql`
        SELECT base_2020, proj_2025, proj_2030, proj_2035, proj_2040, proj_2050
        FROM county_projections
        WHERE county = ${county}
        LIMIT 1
      `,
    ])

    // Permits: compute YoY momentum from most recent two years
    const permitsByYear = permitRows.map(r => ({
      year: r.year as number,
      sfPermits: r.sf_permits as number,
      mfPermits: r.mf_permits as number,
      totalPermits: r.total_permits as number,
    }))

    let permitMomentumPct: number | null = null
    if (permitsByYear.length >= 2) {
      const latest = permitsByYear[0]
      const prior  = permitsByYear[1]
      if (prior.totalPermits > 0) {
        permitMomentumPct = parseFloat(
          (((latest.totalPermits - prior.totalPermits) / prior.totalPermits) * 100).toFixed(1)
        )
      }
    }

    // Enrollment: compute CAGR across available range
    const enrollmentByYear = enrollmentRows.map(r => ({
      year: r.year as number,
      enrollment: r.total_enrollment as number,
    }))

    let enrollmentCagrPct: number | null = null
    if (enrollmentByYear.length >= 2) {
      const first = enrollmentByYear[0]
      const last  = enrollmentByYear[enrollmentByYear.length - 1]
      const years = last.year - first.year
      if (first.enrollment > 0 && years > 0) {
        enrollmentCagrPct = parseFloat(
          ((Math.pow(last.enrollment / first.enrollment, 1 / years) - 1) * 100).toFixed(2)
        )
      }
    }

    const projection = projectionRows[0] ?? null

    return NextResponse.json({
      county,
      permits: {
        available: permitsByYear.length > 0,
        trend: permitsByYear,
        momentumPct: permitMomentumPct,
      },
      enrollment: {
        available: enrollmentByYear.length > 0,
        trend: enrollmentByYear,
        cagrPct: enrollmentCagrPct,
      },
      projection: projection
        ? {
            available: true,
            base2020:  projection.base_2020  ? parseInt(projection.base_2020)  : null,
            proj2025:  projection.proj_2025  ? parseInt(projection.proj_2025)  : null,
            proj2030:  projection.proj_2030  ? parseInt(projection.proj_2030)  : null,
            proj2035:  projection.proj_2035  ? parseInt(projection.proj_2035)  : null,
            proj2040:  projection.proj_2040  ? parseInt(projection.proj_2040)  : null,
            proj2050:  projection.proj_2050  ? parseInt(projection.proj_2050)  : null,
          }
        : { available: false },
    })
  } catch (error) {
    console.error('Leading indicators error:', error)
    return NextResponse.json({ error: 'Failed to load leading indicators', details: String(error) }, { status: 500 })
  }
}
