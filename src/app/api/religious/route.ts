import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const zip = new URL(request.url).searchParams.get('zip')

  try {
    if (zip) {
      // Per-ZIP: return all orgs for this ZIP
      const orgs = await sql`
        SELECT ein, name, street, city, ntee_cd, ntee_category, ntee_label, ruling_year, status
        FROM religious_orgs
        WHERE zip = ${zip}
        ORDER BY ntee_category, name
      `

      const counts = await sql`
        SELECT ntee_category, COUNT(*)::int AS count
        FROM religious_orgs
        WHERE zip = ${zip}
        GROUP BY ntee_category
        ORDER BY count DESC
      `

      return NextResponse.json({ zip, orgs, counts })
    }

    // Overview: DFW-wide stats + top Islamic ZIPs
    const stats = await sql`
      SELECT
        COUNT(*)::int                                                        AS total,
        COUNT(*) FILTER (WHERE ntee_category = 'Islamic')::int              AS islamic,
        COUNT(*) FILTER (WHERE ntee_category = 'Christian')::int            AS christian,
        COUNT(*) FILTER (WHERE ntee_category = 'Jewish')::int               AS jewish,
        COUNT(*) FILTER (WHERE ntee_category = 'Hindu')::int                AS hindu,
        COUNT(*) FILTER (WHERE ntee_category = 'Buddhist')::int             AS buddhist,
        COUNT(*) FILTER (WHERE ntee_category = 'Other')::int                AS other,
        COUNT(*) FILTER (WHERE ruling_year >= 2015)::int                    AS new_since_2015,
        COUNT(*) FILTER (WHERE ntee_category = 'Islamic'
                           AND ruling_year >= 2015)::int                    AS islamic_new
      FROM religious_orgs
    `

    const topIslamicZips = await sql`
      SELECT zip, COUNT(*)::int AS count
      FROM religious_orgs
      WHERE ntee_category = 'Islamic'
      GROUP BY zip
      ORDER BY count DESC
      LIMIT 15
    `

    const byCategory = await sql`
      SELECT ntee_category, COUNT(*)::int AS count
      FROM religious_orgs
      GROUP BY ntee_category
      ORDER BY count DESC
    `

    return NextResponse.json({
      stats: stats[0],
      topIslamicZips,
      byCategory,
    })
  } catch {
    return NextResponse.json({ error: 'religious_orgs table not yet populated — run scripts/import-bmf.ts' }, { status: 503 })
  }
}
