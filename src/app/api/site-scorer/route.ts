import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS, CORE_MSA_ZIP_SET } from '@/lib/zips'

function pf(v: unknown): number {
  return v != null ? parseFloat(String(v)) : 0
}

export async function GET(req: NextRequest) {
  const coverage = req.nextUrl.searchParams.get('coverage') ?? 'core'

  try {
    const rows = await sql`
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
      ORDER BY d.zip
    `

    const filtered = coverage === 'core'
      ? rows.filter(d => CORE_MSA_ZIP_SET.has(d.zip))
      : rows

    const labelMap = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))

    const zips = filtered.map(d => {
      const pop = d.population ?? 0
      const churchCount = typeof d.church_count === 'number' ? d.church_count : parseInt(String(d.church_count ?? '0'))
      const churchesPer10k = pop > 0 ? parseFloat(((churchCount / pop) * 10000).toFixed(2)) : 0

      // YFI (same formula as /api/census)
      const iAge0_17   = d.age_0_17                != null ? pf(d.age_0_17)                : 0
      const iAvgHH     = d.avg_household_size       != null ? pf(d.avg_household_size)       : 2.5
      const iMwKids    = d.hh_married_with_children != null ? pf(d.hh_married_with_children) : 0
      const iSingle    = d.hh_single_parent         != null ? pf(d.hh_single_parent)         : 0
      const iFamilyHH  = iMwKids + iSingle
      const iFertility = d.fertility_rate           != null ? pf(d.fertility_rate) * 100      : 5
      const yfi = Math.round(
        Math.min(100, (iAge0_17 / 30) * 100)                    * 0.40 +
        Math.min(100, (iFamilyHH / 40) * 100)                   * 0.25 +
        Math.min(100, (iFertility / 8) * 100)                   * 0.20 +
        Math.min(100, Math.max(0, (iAvgHH - 1.5) / 2.0 * 100)) * 0.15
      )

      // WFI (same formula as /api/census)
      const iDualEarner = d.dual_earner_pct    != null ? pf(d.dual_earner_pct)    : 0
      const iHHWithKids = d.hh_with_children_pct != null ? pf(d.hh_with_children_pct) : 0
      const iCommute30  = d.commute_30plus_pct  != null ? pf(d.commute_30plus_pct)  : 50
      const iBachRate   = d.bachelors_rate      != null ? pf(d.bachelors_rate)      : 0
      const wfi = Math.round(
        Math.min(100, (iDualEarner / 40) * 100) * 0.40 +
        Math.min(100, (iHHWithKids / 50) * 100) * 0.25 +
        Math.max(0, 100 - iCommute30)            * 0.20 +
        Math.min(100, (iBachRate / 50) * 100)    * 0.15
      )

      return {
        zip:              d.zip,
        label:            labelMap[d.zip] ?? d.zip,
        population:       pop,
        populationGrowth: d.population_growth != null ? pf(d.population_growth) : null,
        sesScore:         d.ses_score != null ? pf(d.ses_score) : 0,
        sesLabel:         d.ses_label ?? '',
        yfi,
        wfi,
        totalChurches:    churchCount,
        churchesPer10k,
      }
    })

    return NextResponse.json({ zips })
  } catch (error) {
    console.error('Site Scorer error:', error)
    return NextResponse.json({ error: 'Failed to load site scorer data', details: String(error) }, { status: 500 })
  }
}
