import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS, CORE_MSA_ZIP_SET } from '@/lib/zips'
import { ZIP_COUNTY } from '@/lib/zip-county'
import { CAMPUSES } from '@/lib/campuses'
import { yfiScore, wfiScore, enrollmentCagrScore } from '@/lib/scoring'
import centroidsJson from '../../../../data/dfw-zip-centroids.json'

function pf(v: unknown): number {
  return v != null ? parseFloat(String(v)) : 0
}

// ZIP centroids (lng, lat) derived from LODES crosswalk block points (scripts/import-lodes.ts).
const CENTROIDS = centroidsJson as Record<string, number[]>
const EXISTING_CAMPUSES = CAMPUSES.filter(c => c.status === 'existing')

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Straight-line distance (mi) from a ZIP's centroid to the nearest EXISTING campus.
function distanceToNearestCampus(zip: string): number | null {
  const c = CENTROIDS[zip]
  if (!c) return null
  const [lng, lat] = c
  let min = Infinity
  for (const camp of EXISTING_CAMPUSES) {
    const d = haversineMi(lat, lng, camp.lat, camp.lng)
    if (d < min) min = d
  }
  return min === Infinity ? null : parseFloat(min.toFixed(1))
}

export async function GET(req: NextRequest) {
  const coverage = req.nextUrl.searchParams.get('coverage') ?? 'core'

  try {
    const [rows, enrollmentRows] = await Promise.all([
      sql`
        SELECT
          d.zip,
          d.population,
          d.population_growth,
          d.ses_score,
          d.ses_label,
          d.age_0_17,
          d.avg_household_size,
          d.hh_married_with_children,
          d.hh_single_parent,
          d.hh_with_children_pct,
          d.fertility_rate,
          d.dual_earner_pct,
          d.commute_30plus_pct,
          d.bachelors_rate,
          COALESCE(c.church_count, 0)::int AS church_count
        FROM zip_demographics d
        LEFT JOIN (
          SELECT zip, COUNT(*)::int AS church_count
          FROM religious_orgs
          WHERE ntee_category = 'Christian'
          GROUP BY zip
        ) c ON d.zip = c.zip
        WHERE COALESCE(d.low_reliability, FALSE) = FALSE
        ORDER BY d.zip
      `,
      // County enrollment CAGR — 2020→2024 where available
      sql`
        SELECT
          county,
          MIN(year) AS first_year,
          MAX(year) AS last_year,
          SUM(CASE WHEN year = (SELECT MIN(year) FROM isd_enrollment ie2 WHERE ie2.county = ie.county) THEN enrollment ELSE 0 END)::int AS first_enr,
          SUM(CASE WHEN year = (SELECT MAX(year) FROM isd_enrollment ie3 WHERE ie3.county = ie.county) THEN enrollment ELSE 0 END)::int AS last_enr
        FROM isd_enrollment ie
        GROUP BY county
      `,
    ])

    // Build county → enrollment CAGR score (0-100)
    // CAGR formula: (last/first)^(1/years) - 1, multiplied by 12 and clamped to 0-100
    const enrollmentScore = new Map<string, number>()
    for (const e of enrollmentRows) {
      const firstEnr = parseInt(String(e.first_enr ?? 0))
      const lastEnr  = parseInt(String(e.last_enr ?? 0))
      const years    = parseInt(String(e.last_year ?? 0)) - parseInt(String(e.first_year ?? 0))
      if (firstEnr > 0 && lastEnr > 0 && years > 0) {
        enrollmentScore.set(e.county as string, enrollmentCagrScore(firstEnr, lastEnr, years))
      }
    }

    const filtered = coverage === 'core'
      ? rows.filter(d => CORE_MSA_ZIP_SET.has(d.zip))
      : rows

    const labelMap = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))

    const zips = filtered.map(d => {
      const pop = d.population ?? 0
      const churchCount = typeof d.church_count === 'number' ? d.church_count : parseInt(String(d.church_count ?? '0'))
      const churchesPer10k = pop > 0 ? parseFloat(((churchCount / pop) * 10000).toFixed(2)) : 0

      // YFI — null-coalesce raw fields to documented fallbacks, then score
      const iAge0_17   = d.age_0_17                != null ? pf(d.age_0_17)                : 0
      const iAvgHH     = d.avg_household_size       != null ? pf(d.avg_household_size)       : 2.5
      const iMwKids    = d.hh_married_with_children != null ? pf(d.hh_married_with_children) : 0
      const iSingle    = d.hh_single_parent         != null ? pf(d.hh_single_parent)         : 0
      const iFertility = d.fertility_rate           != null ? pf(d.fertility_rate) * 100      : 5
      const yfi = yfiScore({
        age0_17Pct: iAge0_17,
        familyHhPct: iMwKids + iSingle,
        fertilityPct: iFertility,
        avgHouseholdSize: iAvgHH,
      })

      // WFI
      const iDualEarner = d.dual_earner_pct    != null ? pf(d.dual_earner_pct)    : 0
      const iHHWithKids = d.hh_with_children_pct != null ? pf(d.hh_with_children_pct) : 0
      const iCommute30  = d.commute_30plus_pct  != null ? pf(d.commute_30plus_pct)  : 50
      const iBachRate   = d.bachelors_rate      != null ? pf(d.bachelors_rate)      : 0
      const wfi = wfiScore({
        dualEarnerPct: iDualEarner,
        hhWithChildrenPct: iHHWithKids,
        commute30plusPct: iCommute30,
        bachelorsRate: iBachRate,
      })

      const county = ZIP_COUNTY[d.zip] ?? null
      const enrollmentGrowthScore = county != null ? (enrollmentScore.get(county) ?? 0) : 0

      return {
        zip:                  d.zip,
        label:                labelMap[d.zip] ?? d.zip,
        population:           pop,
        populationGrowth:     d.population_growth != null ? pf(d.population_growth) : null,
        sesScore:             d.ses_score != null ? pf(d.ses_score) : 0,
        sesLabel:             d.ses_label ?? '',
        yfi,
        wfi,
        totalChurches:        churchCount,
        churchesPer10k,
        enrollmentGrowthScore,
        distanceToCampusMi:   distanceToNearestCampus(d.zip),
        county,
      }
    })

    return NextResponse.json({ zips })
  } catch (error) {
    console.error('Site Scorer error:', error)
    return NextResponse.json({ error: 'Failed to load site scorer data', details: String(error) }, { status: 500 })
  }
}
