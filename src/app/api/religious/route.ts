import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_COUNTY } from '@/lib/zip-county'

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

    // Overview: DFW-wide stats + top Islamic ZIPs + church saturation + county comparison
    const [stats, saturation, topIslamicZips, byCategory, orgsByZip] = await Promise.all([
      sql`
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
      `,

      sql`
        SELECT
          AVG(CASE WHEN d.population > 0 THEN c.church_count::float / d.population * 10000 ELSE NULL END) AS avg_churches_per_10k,
          MAX(CASE WHEN d.population > 0 THEN c.church_count::float / d.population * 10000 ELSE NULL END) AS max_churches_per_10k,
          COUNT(DISTINCT c.zip)::int AS zips_with_churches
        FROM (
          SELECT zip, COUNT(*)::int AS church_count
          FROM religious_orgs
          WHERE ntee_category = 'Christian'
          GROUP BY zip
        ) c
        JOIN zip_demographics d ON c.zip = d.zip
      `,

      sql`
        SELECT zip, COUNT(*)::int AS count
        FROM religious_orgs
        WHERE ntee_category = 'Islamic'
        GROUP BY zip
        ORDER BY count DESC
        LIMIT 15
      `,

      sql`
        SELECT ntee_category, COUNT(*)::int AS count
        FROM religious_orgs
        GROUP BY ntee_category
        ORDER BY count DESC
      `,

      // Per-ZIP counts for Islamic + Christian — used to build county comparison in JS
      sql`
        SELECT zip, ntee_category, COUNT(*)::int AS count
        FROM religious_orgs
        WHERE ntee_category IN ('Islamic', 'Christian')
        GROUP BY zip, ntee_category
      `,
    ])

    // Aggregate per-ZIP counts into county buckets
    const islamicByCounty: Record<string, number> = {}
    const christianByCounty: Record<string, number> = {}

    for (const row of orgsByZip) {
      const county = ZIP_COUNTY[row.zip as string] ?? 'Other'
      if (row.ntee_category === 'Islamic') {
        islamicByCounty[county] = (islamicByCounty[county] ?? 0) + (row.count as number)
      } else {
        christianByCounty[county] = (christianByCounty[county] ?? 0) + (row.count as number)
      }
    }

    const allCounties = new Set([
      ...Object.keys(islamicByCounty),
      ...Object.keys(christianByCounty),
    ])

    const countyComparison = Array.from(allCounties)
      .map(county => ({
        county,
        islamic: islamicByCounty[county] ?? 0,
        christian: christianByCounty[county] ?? 0,
      }))
      .filter(r => r.islamic > 0)
      .sort((a, b) => b.islamic - a.islamic)

    return NextResponse.json({
      stats: stats[0],
      topIslamicZips,
      byCategory,
      saturation: saturation[0] ?? null,
      countyComparison,
    })
  } catch {
    return NextResponse.json({ error: 'religious_orgs table not yet populated — run scripts/import-bmf.ts' }, { status: 503 })
  }
}
