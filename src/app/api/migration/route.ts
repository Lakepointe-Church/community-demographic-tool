/**
 * GET /api/migration?zip=75126
 *
 * IRS SOI county-to-county migration for a ZIP's county (TY2022→2023, context tier).
 * Mapped from ZIP via zip-county.ts. Returns inbound/outbound household totals,
 * net migration, avg AGI of in-migrants, and the top origin/destination counties.
 *
 * Graceful degradation: returns { available: false } until import-soi-migration.ts is run.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_COUNTY } from '@/lib/zip-county'

// avg AGI per return, in whole dollars (file stores AGI in $1000s)
function avgAgi(agi: number, returns: number): number | null {
  return returns > 0 ? Math.round((agi * 1000) / returns) : null
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  const county = ZIP_COUNTY[zip]
  if (!county) return NextResponse.json({ error: `No county mapping for ZIP ${zip}` }, { status: 404 })

  try {
    const rows = await sql`
      SELECT direction, kind, other_fips, other_name, other_state, returns, individuals, agi, year
      FROM county_migration
      WHERE county = ${county}
      ORDER BY year DESC, returns DESC
    `

    if (rows.length === 0) {
      return NextResponse.json({ available: false, zip, county })
    }

    const year = Math.max(...rows.map(r => r.year as number))
    const yr = rows.filter(r => r.year === year)

    const inTotal = yr.find(r => r.direction === 'in' && r.kind === 'total')
    const outTotal = yr.find(r => r.direction === 'out' && r.kind === 'total')

    const cleanName = (n: string | null) => (n ?? '').replace(/\s+County$/, '')

    const mapCounty = (r: typeof rows[number]) => {
      const returns = r.returns as number
      const agi = r.agi as number
      return {
        fips: r.other_fips as string,
        name: cleanName(r.other_name as string),
        state: r.other_state as string | null,
        returns,
        individuals: r.individuals as number,
        avgAgi: avgAgi(agi, returns),
      }
    }

    const topOrigins = yr.filter(r => r.direction === 'in' && r.kind === 'county').map(mapCounty)
    const topDestinations = yr.filter(r => r.direction === 'out' && r.kind === 'county').map(mapCounty)

    const inboundHouseholds = (inTotal?.returns as number) ?? null
    const outboundHouseholds = (outTotal?.returns as number) ?? null
    const netHouseholds =
      inboundHouseholds != null && outboundHouseholds != null ? inboundHouseholds - outboundHouseholds : null

    return NextResponse.json({
      available: true,
      zip,
      county,
      year,
      inboundHouseholds,
      outboundHouseholds,
      netHouseholds,
      inboundIndividuals: (inTotal?.individuals as number) ?? null,
      outboundIndividuals: (outTotal?.individuals as number) ?? null,
      inboundAvgAgi: inTotal ? avgAgi(inTotal.agi as number, inTotal.returns as number) : null,
      outboundAvgAgi: outTotal ? avgAgi(outTotal.agi as number, outTotal.returns as number) : null,
      topOrigins,
      topDestinations,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Failed to load migration data', details: String(error) }, { status: 500 })
  }
}
