import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

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

    const results = rows.map(d => ({
      zip: d.zip,
      name: d.name,
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
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Census batch error:', error)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(error) }, { status: 500 })
  }
}
