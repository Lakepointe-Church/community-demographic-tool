import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS } from '@/lib/zips'

const ZIP_LABEL: Record<string, string> = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const zipsParam = searchParams.get('zips')

  if (!zipsParam) {
    return NextResponse.json({ error: 'zips parameter required' }, { status: 400 })
  }

  const zips = zipsParam.split(',').map(z => z.trim()).filter(Boolean).slice(0, 20)
  if (!zips.length) return NextResponse.json({ results: [] })

  try {
    const rows = await sql`SELECT * FROM zip_demographics WHERE zip = ANY(${zips})`

    const results = rows.map(d => {
      const iAge0_17    = d.age_0_17                 != null ? parseFloat(d.age_0_17)                 : 0
      const iAvgHH      = d.avg_household_size        != null ? parseFloat(d.avg_household_size)        : 2.5
      const iMwKids     = d.hh_married_with_children  != null ? parseFloat(d.hh_married_with_children)  : 0
      const iSingle     = d.hh_single_parent          != null ? parseFloat(d.hh_single_parent)          : 0
      const iFamilyHH   = iMwKids + iSingle
      const iFertility  = d.fertility_rate            != null ? parseFloat(d.fertility_rate) * 100      : 5
      const iDualEarner = d.dual_earner_pct           != null ? parseFloat(d.dual_earner_pct)           : 0
      const iCommute30  = d.commute_30plus_pct        != null ? parseFloat(d.commute_30plus_pct)        : 50
      const iHHWithKids = d.hh_with_children_pct      != null ? parseFloat(d.hh_with_children_pct)      : 0
      const iBachRate   = d.bachelors_rate            != null ? parseFloat(d.bachelors_rate)            : 0

      const yfi = Math.round(
        Math.min(100, (iAge0_17 / 30) * 100)                      * 0.40 +
        Math.min(100, (iFamilyHH / 40) * 100)                     * 0.25 +
        Math.min(100, (iFertility / 8) * 100)                     * 0.20 +
        Math.min(100, Math.max(0, (iAvgHH - 1.5) / 2.0 * 100))   * 0.15
      )
      const wfi = Math.round(
        Math.min(100, (iDualEarner / 40) * 100)                   * 0.40 +
        Math.min(100, (iHHWithKids / 50) * 100)                   * 0.25 +
        Math.max(0, 100 - iCommute30)                              * 0.20 +
        Math.min(100, (iBachRate / 50) * 100)                      * 0.15
      )

      return {
        zip: d.zip,
        name: ZIP_LABEL[d.zip] ?? d.name?.replace('ZCTA5 ', '') ?? d.zip,
        population: d.population,
        population2020: d.population_2020,
        populationGrowth: d.population_growth != null ? parseFloat(d.population_growth) : null,
        medianHouseholdIncome: d.median_household_income,
        medianHomeValue: d.median_home_value,
        totalHouseholds: d.total_households,
        avgHouseholdSize: d.avg_household_size != null ? parseFloat(d.avg_household_size) : null,
        hhWithChildrenPct: d.hh_with_children_pct != null ? parseFloat(d.hh_with_children_pct) : null,
        unemploymentRate: d.unemployment_rate,
        sesClass: { label: d.ses_label, score: d.ses_score },
        race: {
          white:    d.race_white    != null ? parseFloat(d.race_white)    : 0,
          hispanic: d.race_hispanic != null ? parseFloat(d.race_hispanic) : 0,
          black:    d.race_black    != null ? parseFloat(d.race_black)    : 0,
          asian:    d.race_asian    != null ? parseFloat(d.race_asian)    : 0,
          other:    d.race_other    != null ? parseFloat(d.race_other)    : 0,
        },
        incomeBrackets: [
          { label: '<$25K',     pct: d.income_lt25k     != null ? parseFloat(d.income_lt25k)     : 0 },
          { label: '$25-50K',   pct: d.income_25_50k    != null ? parseFloat(d.income_25_50k)    : 0 },
          { label: '$50-75K',   pct: d.income_50_75k    != null ? parseFloat(d.income_50_75k)    : 0 },
          { label: '$75-100K',  pct: d.income_75_100k   != null ? parseFloat(d.income_75_100k)   : 0 },
          { label: '$100-150K', pct: d.income_100_150k  != null ? parseFloat(d.income_100_150k)  : 0 },
          { label: '$150K+',    pct: d.income_150k_plus != null ? parseFloat(d.income_150k_plus) : 0 },
        ],
        yfi,
        wfi,
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Census batch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(error) }, { status: 500 })
  }
}
