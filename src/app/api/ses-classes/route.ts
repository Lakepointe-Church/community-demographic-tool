import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        zip, name, ses_label, ses_score,
        median_household_income, bachelors_rate, unemployment_rate,
        occ_mgmt_prof_pct, population_growth
      FROM zip_demographics
      WHERE ses_label IS NOT NULL
      ORDER BY ses_score DESC NULLS LAST
    `

    const tiers = ['Upper', 'Upper Middle', 'Middle', 'Lower Middle', 'Lower Income']
    const countByTier: Record<string, number> = Object.fromEntries(tiers.map(t => [t, 0]))
    let scoreSum = 0

    const zips = rows.map(d => {
      const score = d.ses_score != null ? parseInt(d.ses_score) : 0
      scoreSum += score
      if (d.ses_label && countByTier[d.ses_label] !== undefined) countByTier[d.ses_label]++
      return {
        zip:                  d.zip,
        name:                 d.name,
        sesLabel:             d.ses_label,
        sesScore:             score,
        medianHouseholdIncome: d.median_household_income,
        bachelorsRate:        d.bachelors_rate != null ? parseFloat(d.bachelors_rate) : null,
        unemploymentRate:     d.unemployment_rate != null ? parseFloat(d.unemployment_rate) : null,
        occMgmtProfPct:       d.occ_mgmt_prof_pct != null ? parseFloat(d.occ_mgmt_prof_pct) : null,
        populationGrowth:     d.population_growth != null ? parseFloat(d.population_growth) : null,
      }
    })

    return NextResponse.json({
      zips,
      summary: {
        avgScore:    rows.length > 0 ? Math.round(scoreSum / rows.length) : 0,
        total:       rows.length,
        countByTier,
      },
    })
  } catch (error) {
    console.error('SES Classes error:', error)
    return NextResponse.json({ error: 'Failed to fetch SES data' }, { status: 500 })
  }
}
